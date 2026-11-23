// Package models reads the versioned LMSpeed model catalogue without background network activity.
package models

import (
	"bytes"
	"context"
	"crypto/sha256"
	_ "embed"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/cyberphone/json-canonicalization/go/src/webpki.org/jsoncanonicalizer"
	"github.com/santhosh-tekuri/jsonschema/v6"
)

const Version = "0.1.1"
const DefaultURL = "https://models.lmspeed.net"

//go:embed schema.json
var schemaBytes []byte
var compiledSchema *jsonschema.Schema
var schemaError error
var schemaOnce sync.Once

type Error struct {
	Code       string
	Message    string
	Candidates []string
}

func (e *Error) Error() string { return e.Code + ": " + e.Message }

type ResolutionResult struct {
	Status      string   `json:"status"`
	CanonicalID string   `json:"canonicalId,omitempty"`
	Namespace   string   `json:"namespace,omitempty"`
	Candidates  []string `json:"candidates,omitempty"`
}
type Filter struct {
	Task        string
	Input       string
	Output      string
	DeveloperID string
}
type LogoInfo struct {
	ModelID  string  `json:"modelId"`
	Key      *string `json:"key"`
	Level    string  `json:"level"`
	Fallback bool    `json:"fallback"`
	Source   string  `json:"source"`
	Version  string  `json:"version"`
	SHA256   string  `json:"sha256"`
}
type LogoIndex struct {
	SchemaVersion int                 `json:"schemaVersion"`
	Revision      int64               `json:"revision"`
	Models        map[string]LogoInfo `json:"models"`
}
type Catalog struct {
	Snapshot Snapshot
	BaseURL  string
	logos    *LogoIndex
}

func relax(value interface{}) {
	switch item := value.(type) {
	case map[string]interface{}:
		for key, value := range item {
			if key == "additionalProperties" && value == false {
				item[key] = true
			} else {
				relax(value)
			}
		}
	case []interface{}:
		for _, value := range item {
			relax(value)
		}
	}
}
func validateJSON(raw []byte) error {
	schemaOnce.Do(func() {
		var schema interface{}
		schemaError = json.Unmarshal(schemaBytes, &schema)
		if schemaError != nil {
			return
		}
		relax(schema)
		compiler := jsonschema.NewCompiler()
		if schemaError = compiler.AddResource("schema.json", schema); schemaError == nil {
			compiledSchema, schemaError = compiler.Compile("schema.json")
		}
	})
	if schemaError != nil {
		return schemaError
	}
	value, err := jsonschema.UnmarshalJSON(bytes.NewReader(raw))
	if err != nil {
		return err
	}
	return compiledSchema.Validate(value)
}
func LoadJSON(raw []byte) (*Catalog, error) {
	var header struct {
		SchemaVersion float64         `json:"schemaVersion"`
		Data          json.RawMessage `json:"data"`
		SHA256        string          `json:"sha256"`
	}
	if err := json.Unmarshal(raw, &header); err != nil {
		return nil, &Error{Code: "invalid_json", Message: err.Error()}
	}
	if header.SchemaVersion != 1 {
		return nil, &Error{Code: "schema_incompatible", Message: "Unsupported schema major version"}
	}
	if err := validateJSON(raw); err != nil {
		return nil, &Error{Code: "invalid_contract", Message: err.Error()}
	}
	canonical, err := jsoncanonicalizer.Transform(header.Data)
	if err != nil {
		return nil, &Error{Code: "invalid_contract", Message: err.Error()}
	}
	digest := sha256.Sum256(canonical)
	if hex.EncodeToString(digest[:]) != header.SHA256 {
		return nil, &Error{Code: "invalid_contract", Message: "Snapshot hash mismatch"}
	}
	var snapshot Snapshot
	if err = json.Unmarshal(raw, &snapshot); err != nil {
		return nil, &Error{Code: "invalid_contract", Message: err.Error()}
	}
	if snapshot.Revision != snapshot.Data.Aliases.Revision || snapshot.Counts.Models != int64(len(snapshot.Data.Models)) || snapshot.Counts.Developers != int64(len(snapshot.Data.Developers)) {
		return nil, &Error{Code: "invalid_contract", Message: "Snapshot count or alias revision mismatch"}
	}
	for key, model := range snapshot.Data.Models {
		if key != model.ID {
			return nil, &Error{Code: "invalid_contract", Message: "Canonical ID mismatch"}
		}
		if _, ok := snapshot.Data.Developers[model.DeveloperID]; !ok {
			return nil, &Error{Code: "invalid_contract", Message: "Missing developer"}
		}
	}
	for _, alias := range snapshot.Data.Aliases.Models {
		if _, ok := snapshot.Data.Models[alias.CanonicalID]; !ok {
			return nil, &Error{Code: "invalid_contract", Message: "Missing alias target"}
		}
	}
	return &Catalog{Snapshot: snapshot, BaseURL: DefaultURL}, nil
}
func normalize(value string, sensitive bool) string {
	value = strings.Trim(value, " \t\r\n")
	if sensitive {
		return value
	}
	return strings.Map(func(c rune) rune {
		if c >= 'A' && c <= 'Z' {
			return c + 32
		}
		return c
	}, value)
}
func (c *Catalog) ResolveModelID(value, namespace string) ResolutionResult {
	value = normalize(value, true)
	if namespace == "" {
		if _, ok := c.Snapshot.Data.Models[value]; ok {
			return ResolutionResult{Status: "resolved", CanonicalID: value, Namespace: "canonical"}
		}
	}
	matches := []ModelElement{}
	globals := []ModelElement{}
	for _, alias := range c.Snapshot.Data.Aliases.Models {
		if namespace != "" && alias.Namespace != namespace {
			continue
		}
		rule, ok := c.Snapshot.Data.Aliases.Namespaces[alias.Namespace]
		sensitive := true
		if ok {
			sensitive = rule.CaseSensitive
		}
		if normalize(alias.Value, sensitive) == normalize(value, sensitive) {
			matches = append(matches, alias)
			if alias.Namespace == "global" {
				globals = append(globals, alias)
			}
		}
	}
	if namespace == "" && len(globals) > 0 {
		matches = globals
	}
	unique := map[string]bool{}
	for _, alias := range matches {
		unique[alias.CanonicalID] = true
	}
	candidates := []string{}
	for id := range unique {
		candidates = append(candidates, id)
	}
	sort.Strings(candidates)
	if len(candidates) != 1 {
		result := "not_found"
		if len(candidates) > 0 {
			result = "ambiguous"
		}
		return ResolutionResult{Status: result, Candidates: candidates}
	}
	sort.Slice(matches, func(i, j int) bool { return matches[i].Namespace < matches[j].Namespace })
	return ResolutionResult{Status: "resolved", CanonicalID: candidates[0], Namespace: matches[0].Namespace}
}
func (c *Catalog) Get(value, namespace string) (ModelValue, error) {
	resolved := c.ResolveModelID(value, namespace)
	if resolved.Status != "resolved" {
		return ModelValue{}, &Error{Code: resolved.Status, Message: value, Candidates: resolved.Candidates}
	}
	return c.Snapshot.Data.Models[resolved.CanonicalID], nil
}
func contains(values []string, value string) bool {
	for _, entry := range values {
		if entry == value {
			return true
		}
	}
	return false
}
func (c *Catalog) Filter(filter Filter) []ModelValue {
	result := []ModelValue{}
	for _, model := range c.Snapshot.Data.Models {
		if filter.Task != "" && !contains(model.Tasks, filter.Task) || filter.Input != "" && !contains(model.Modalities.Input, filter.Input) || filter.Output != "" && !contains(model.Modalities.Output, filter.Output) || filter.DeveloperID != "" && model.DeveloperID != filter.DeveloperID {
			continue
		}
		result = append(result, model)
	}
	sort.Slice(result, func(i, j int) bool { return result[i].ID < result[j].ID })
	return result
}
func (c *Catalog) IconURL(value, namespace string) (string, error) {
	model, err := c.Get(value, namespace)
	if err != nil {
		return "", err
	}
	return strings.TrimRight(c.BaseURL, "/") + "/v1/models/" + url.PathEscape(model.ID) + ".svg", nil
}
func (c *Catalog) Sources(value, field, namespace string) ([]SourceElement, error) {
	model, err := c.Get(value, namespace)
	if err != nil {
		return nil, err
	}
	if field == "" {
		return model.Sources, nil
	}
	result := []SourceElement{}
	for _, source := range model.Sources {
		for _, path := range source.Fields {
			if field == path || strings.HasPrefix(field, path+"/") {
				result = append(result, source)
				break
			}
		}
	}
	return result, nil
}
func (c *Catalog) UpstreamFacts(value, namespace string) ([]ModelsDev, error) {
	model, err := c.Get(value, namespace)
	if err != nil {
		return nil, err
	}
	if model.UpstreamFacts == nil {
		return []ModelsDev{}, nil
	}
	return model.UpstreamFacts.ModelsDev, nil
}
func (c *Catalog) AttachLogos(logos *LogoIndex) error {
	if logos.SchemaVersion != 1 {
		return &Error{Code: "schema_incompatible", Message: "Unsupported logo schema"}
	}
	if logos.Revision != c.Snapshot.Revision {
		return &Error{Code: "revision_mismatch", Message: "Logo metadata belongs to another revision"}
	}
	c.logos = logos
	return nil
}
func (c *Catalog) IconInfo(value, namespace string) (LogoInfo, error) {
	if c.logos == nil {
		return LogoInfo{}, &Error{Code: "not_loaded", Message: "Load logo metadata first"}
	}
	model, err := c.Get(value, namespace)
	if err != nil {
		return LogoInfo{}, err
	}
	info, ok := c.logos.Models[model.ID]
	if !ok {
		return LogoInfo{}, &Error{Code: "invalid_contract", Message: "Missing logo metadata"}
	}
	return info, nil
}

type Client struct {
	BaseURL    string
	HTTPClient *http.Client
	mu         sync.Mutex
	etag       string
	current    *Catalog
}

func NewClient(baseURL string) *Client {
	if baseURL == "" {
		baseURL = DefaultURL
	}
	return &Client{BaseURL: strings.TrimRight(baseURL, "/"), HTTPClient: &http.Client{Timeout: 30 * time.Second}}
}
func (c *Client) Current() *Catalog { c.mu.Lock(); defer c.mu.Unlock(); return c.current }
func (c *Client) request(ctx context.Context, path, etag string) (*http.Response, error) {
	request, err := http.NewRequestWithContext(ctx, "GET", c.BaseURL+path, nil)
	if err != nil {
		return nil, &Error{Code: "network", Message: err.Error()}
	}
	if etag != "" {
		request.Header.Set("If-None-Match", etag)
	}
	response, err := c.HTTPClient.Do(request)
	if err != nil {
		code := "network"
		if errors.Is(err, context.Canceled) {
			code = "cancelled"
		} else if errors.Is(err, context.DeadlineExceeded) {
			code = "timeout"
		}
		return nil, &Error{Code: code, Message: err.Error()}
	}
	if response.StatusCode != 304 && (response.StatusCode < 200 || response.StatusCode >= 300) {
		response.Body.Close()
		code := "network"
		if response.StatusCode == 404 {
			code = "not_found"
		}
		return nil, &Error{Code: code, Message: fmt.Sprintf("HTTP %d", response.StatusCode)}
	}
	return response, nil
}
func (c *Client) Refresh(ctx context.Context) (*Catalog, error) {
	c.mu.Lock()
	etag := c.etag
	c.mu.Unlock()
	response, err := c.request(ctx, "/v1/api.json", etag)
	if err != nil {
		return nil, err
	}
	defer response.Body.Close()
	if response.StatusCode == 304 {
		if current := c.Current(); current != nil {
			return current, nil
		}
		return nil, &Error{Code: "invalid_contract", Message: "304 without loaded catalogue"}
	}
	raw, err := io.ReadAll(io.LimitReader(response.Body, 64<<20))
	if err != nil {
		return nil, &Error{Code: "network", Message: err.Error()}
	}
	catalog, err := LoadJSON(raw)
	if err != nil {
		return nil, err
	}
	catalog.BaseURL = c.BaseURL
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.current != nil && (c.current.Snapshot.Revision > catalog.Snapshot.Revision || c.current.Snapshot.Revision == catalog.Snapshot.Revision && c.current.Snapshot.Sha256 != catalog.Snapshot.Sha256) {
		return nil, &Error{Code: "revision_mismatch", Message: "Source revision regressed or changed without a new revision"}
	}
	c.current = catalog
	c.etag = response.Header.Get("ETag")
	return catalog, nil
}
func (c *Client) Get(ctx context.Context, value, namespace string) (ModelValue, error) {
	catalog := c.Current()
	if catalog == nil {
		var err error
		catalog, err = c.Refresh(ctx)
		if err != nil {
			return ModelValue{}, err
		}
	}
	return catalog.Get(value, namespace)
}
func (c *Client) Logos(ctx context.Context) (*LogoIndex, error) {
	catalog := c.Current()
	if catalog == nil {
		var err error
		catalog, err = c.Refresh(ctx)
		if err != nil {
			return nil, err
		}
	}
	response, err := c.request(ctx, "/logos.json", "")
	if err != nil {
		return nil, err
	}
	defer response.Body.Close()
	var logos LogoIndex
	if err = json.NewDecoder(response.Body).Decode(&logos); err != nil {
		return nil, &Error{Code: "invalid_json", Message: err.Error()}
	}
	if err = catalog.AttachLogos(&logos); err != nil {
		return nil, err
	}
	return &logos, nil
}
func (c *Client) Coverage(ctx context.Context) (map[string]interface{}, error) {
	response, err := c.request(ctx, "/coverage/models-dev.json", "")
	if err != nil {
		return nil, err
	}
	defer response.Body.Close()
	var result map[string]interface{}
	if err = json.NewDecoder(response.Body).Decode(&result); err != nil {
		return nil, &Error{Code: "invalid_json", Message: err.Error()}
	}
	if current := c.Current(); current != nil && result["revision"] != float64(current.Snapshot.Revision) {
		return nil, &Error{Code: "revision_mismatch", Message: "Coverage belongs to another revision"}
	}
	return result, nil
}
