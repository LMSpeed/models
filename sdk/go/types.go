package models

import "time"

type Snapshot struct {
	Counts        Counts        `json:"counts"`
	Data          Data          `json:"data"`
	DataUpdatedAt time.Time     `json:"dataUpdatedAt"`
	Revision      int64         `json:"revision"`
	SchemaVersion float64       `json:"schemaVersion"`
	Scope         SnapshotScope `json:"scope"`
	Sha256        string        `json:"sha256"`
}

type Counts struct {
	Developers int64 `json:"developers"`
	Models     int64 `json:"models"`
}

type Data struct {
	Aliases    Aliases                   `json:"aliases"`
	Developers map[string]DeveloperValue `json:"developers"`
	Models     map[string]ModelValue     `json:"models"`
	Redirects  []Redirect                `json:"redirects"`
	Upstreams  []Upstream                `json:"upstreams"`
}

type Aliases struct {
	Developers    []DeveloperElement   `json:"developers"`
	Families      []Family             `json:"families"`
	Models        []ModelElement       `json:"models"`
	Namespaces    map[string]Namespace `json:"namespaces"`
	Revision      int64                `json:"revision"`
	SchemaVersion float64              `json:"schemaVersion"`
}

type DeveloperElement struct {
	CanonicalID string             `json:"canonicalId"`
	History     []DeveloperHistory `json:"history,omitempty"`
	Kind        DeveloperKind      `json:"kind"`
	Namespace   string             `json:"namespace"`
	Revision    *int64             `json:"revision,omitempty"`
	RouteKey    string             `json:"routeKey"`
	Source      DeveloperSource    `json:"source"`
	Value       string             `json:"value"`
}

type DeveloperHistory struct {
	CanonicalID string `json:"canonicalId"`
	Revision    int64  `json:"revision"`
}

type DeveloperSource struct {
	Commit *string `json:"commit,omitempty"`
	Path   *string `json:"path,omitempty"`
	URL    string  `json:"url"`
}

type Family struct {
	CanonicalID string          `json:"canonicalId"`
	History     []FamilyHistory `json:"history,omitempty"`
	Kind        DeveloperKind   `json:"kind"`
	Namespace   string          `json:"namespace"`
	Revision    *int64          `json:"revision,omitempty"`
	RouteKey    string          `json:"routeKey"`
	Source      FamilySource    `json:"source"`
	Value       string          `json:"value"`
}

type FamilyHistory struct {
	CanonicalID string `json:"canonicalId"`
	Revision    int64  `json:"revision"`
}

type FamilySource struct {
	Commit *string `json:"commit,omitempty"`
	Path   *string `json:"path,omitempty"`
	URL    string  `json:"url"`
}

type ModelElement struct {
	CanonicalID string         `json:"canonicalId"`
	History     []ModelHistory `json:"history,omitempty"`
	Kind        DeveloperKind  `json:"kind"`
	Namespace   string         `json:"namespace"`
	Revision    *int64         `json:"revision,omitempty"`
	RouteKey    string         `json:"routeKey"`
	Source      PurpleSource   `json:"source"`
	Value       string         `json:"value"`
}

type ModelHistory struct {
	CanonicalID string `json:"canonicalId"`
	Revision    int64  `json:"revision"`
}

type PurpleSource struct {
	Commit *string `json:"commit,omitempty"`
	Path   *string `json:"path,omitempty"`
	URL    string  `json:"url"`
}

type Namespace struct {
	CaseSensitive bool `json:"caseSensitive"`
}

type DeveloperValue struct {
	ID      string  `json:"id"`
	Name    string  `json:"name"`
	Website *string `json:"website"`
}

type ModelValue struct {
	Architecture    *string             `json:"architecture"`
	Capabilities    Capabilities        `json:"capabilities"`
	Description     *string             `json:"description,omitempty"`
	DeveloperID     string              `json:"developerId"`
	ExternalIDS     map[string][]string `json:"externalIds,omitempty"`
	FamilyID        *string             `json:"familyId,omitempty"`
	FileFormats     *FileFormats        `json:"fileFormats,omitempty"`
	ID              string              `json:"id"`
	KnowledgeCutoff *string             `json:"knowledgeCutoff"`
	Languages       []string            `json:"languages"`
	LastUpdated     *string             `json:"lastUpdated"`
	Lifecycle       *Lifecycle          `json:"lifecycle"`
	Links           []Link              `json:"links,omitempty"`
	Modalities      Modalities          `json:"modalities"`
	ModelLicense    *string             `json:"modelLicense"`
	Name            string              `json:"name"`
	OpenWeights     *bool               `json:"openWeights"`
	Parameters      *Parameters         `json:"parameters,omitempty"`
	ReleaseDate     *string             `json:"releaseDate"`
	Sources         []SourceElement     `json:"sources"`
	Specs           Specs               `json:"specs"`
	Tasks           []string            `json:"tasks"`
	UpstreamFacts   *UpstreamFacts      `json:"upstreamFacts,omitempty"`
	Weights         []Weight            `json:"weights,omitempty"`
}

type Capabilities struct {
	Reasoning   *bool  `json:"reasoning"`
	Temperature *bool  `json:"temperature"`
	ToolCalling *bool  `json:"toolCalling"`
	Tools       *Tools `json:"tools,omitempty"`
	TopK        *bool  `json:"topK"`
	TopP        *bool  `json:"topP"`
}

type Tools struct {
	Choice   []string `json:"choice,omitempty"`
	Freeform []string `json:"freeform,omitempty"`
	Search   *bool    `json:"search,omitempty"`
	Strict   *bool    `json:"strict,omitempty"`
	Updates  []string `json:"updates,omitempty"`
}

type FileFormats struct {
	Input  []string `json:"input"`
	Output []string `json:"output"`
}

type Link struct {
	Label *string `json:"label,omitempty"`
	Type  *string `json:"type,omitempty"`
	URL   string  `json:"url"`
}

type Modalities struct {
	Input  []string `json:"input"`
	Output []string `json:"output"`
}

type Parameters struct {
	ActiveBillions *float64 `json:"activeBillions"`
	TotalBillions  *float64 `json:"totalBillions"`
}

type SourceElement struct {
	// Verification date or UTC timestamp, preserving source precision. observedAt records
	// acquisition separately.
	CheckedAt   *string     `json:"checkedAt,omitempty"`
	Commit      *string     `json:"commit,omitempty"`
	Fields      []string    `json:"fields"`
	License     *string     `json:"license,omitempty"`
	ObservedAt  *time.Time  `json:"observedAt,omitempty"`
	Path        *string     `json:"path,omitempty"`
	Repository  *string     `json:"repository,omitempty"`
	Scope       SourceScope `json:"scope"`
	SourceField *string     `json:"sourceField,omitempty"`
	URL         string      `json:"url"`
}

type Specs struct {
	Audio     *Audio     `json:"audio,omitempty"`
	Document  *Document  `json:"document,omitempty"`
	Embedding *Embedding `json:"embedding,omitempty"`
	Image     *Image     `json:"image,omitempty"`
	Request   *Request   `json:"request,omitempty"`
	Text      *Text      `json:"text,omitempty"`
	Video     *Video     `json:"video,omitempty"`
}

type Audio struct {
	Channels        *float64 `json:"channels"`
	DurationSeconds *float64 `json:"durationSeconds"`
	SampleRateHz    *float64 `json:"sampleRateHz"`
}

type Document struct {
	MaxBytes      *float64 `json:"maxBytes"`
	MaxPages      *float64 `json:"maxPages"`
	MaxPerRequest *float64 `json:"maxPerRequest"`
}

type Embedding struct {
	Dimensions     []int64  `json:"dimensions"`
	MaxInputTokens *float64 `json:"maxInputTokens"`
}

type Image struct {
	AspectRatios []string `json:"aspectRatios"`
	// Sizes demonstrated in official inference examples; not a declaration of an exhaustive set
	// or a maximum.
	DocumentedSizes    []DocumentedSize `json:"documentedSizes"`
	Editing            *bool            `json:"editing"`
	Generation         *bool            `json:"generation"`
	MaxBytes           *float64         `json:"maxBytes"`
	MaxHeightPixels    *float64         `json:"maxHeightPixels"`
	MaxPerMessage      *float64         `json:"maxPerMessage"`
	MaxPerRequest      *float64         `json:"maxPerRequest"`
	MaxPixels          *float64         `json:"maxPixels"`
	MaxReferenceImages *float64         `json:"maxReferenceImages"`
	MaxWidthPixels     *float64         `json:"maxWidthPixels"`
	MinHeightPixels    *float64         `json:"minHeightPixels"`
	MinWidthPixels     *float64         `json:"minWidthPixels"`
	MultiReference     *bool            `json:"multiReference"`
	Sizes              []Size           `json:"sizes"`
}

type DocumentedSize struct {
	HeightPixels int64 `json:"heightPixels"`
	WidthPixels  int64 `json:"widthPixels"`
}

type Size struct {
	HeightPixels float64 `json:"heightPixels"`
	WidthPixels  float64 `json:"widthPixels"`
}

type Request struct {
	MaxBytes *float64 `json:"maxBytes"`
}

type Text struct {
	ContextWindowTokens *float64 `json:"contextWindowTokens"`
	MaxInputTokens      *float64 `json:"maxInputTokens"`
	MaxOutputTokens     *float64 `json:"maxOutputTokens"`
	Tokenizer           *string  `json:"tokenizer"`
}

type Video struct {
	DurationSeconds *float64 `json:"durationSeconds"`
	FramesPerSecond *float64 `json:"framesPerSecond"`
	MaxHeightPixels *float64 `json:"maxHeightPixels"`
	MaxWidthPixels  *float64 `json:"maxWidthPixels"`
}

type UpstreamFacts struct {
	ModelsDev []ModelsDev `json:"modelsDev"`
}

type ModelsDev struct {
	Conflict    bool            `json:"conflict"`
	Field       string          `json:"field"`
	Resolution  *Resolution     `json:"resolution,omitempty"`
	Source      ModelsDevSource `json:"source"`
	SourceField string          `json:"sourceField"`
	Value       interface{}     `json:"value"`
}

type ModelsDevSource struct {
	// Verification date or UTC timestamp, preserving source precision. observedAt records
	// acquisition separately.
	CheckedAt   *string     `json:"checkedAt,omitempty"`
	Commit      *string     `json:"commit,omitempty"`
	Fields      []string    `json:"fields"`
	License     *string     `json:"license,omitempty"`
	ObservedAt  *time.Time  `json:"observedAt,omitempty"`
	Path        *string     `json:"path,omitempty"`
	Repository  *string     `json:"repository,omitempty"`
	Scope       SourceScope `json:"scope"`
	SourceField *string     `json:"sourceField,omitempty"`
	URL         string      `json:"url"`
}

type Weight struct {
	Format       *string `json:"format,omitempty"`
	Label        *string `json:"label,omitempty"`
	Quantization *string `json:"quantization,omitempty"`
	URL          string  `json:"url"`
}

type Redirect struct {
	From     string       `json:"from"`
	Kind     RedirectKind `json:"kind"`
	Reason   string       `json:"reason"`
	Revision int64        `json:"revision"`
	To       *string      `json:"to"`
}

type Upstream struct {
	Commit              string    `json:"commit"`
	ID                  string    `json:"id"`
	LastCheckedAt       time.Time `json:"lastCheckedAt"`
	LatestCheckedCommit string    `json:"latestCheckedCommit"`
	License             string    `json:"license"`
	ModelCount          int64     `json:"modelCount"`
	ObservedAt          time.Time `json:"observedAt"`
	Repository          string    `json:"repository"`
}

type DeveloperKind string

const (
	Fixed  DeveloperKind = "fixed"
	Moving DeveloperKind = "moving"
)

type Lifecycle string

const (
	Active     Lifecycle = "active"
	Alpha      Lifecycle = "alpha"
	Beta       Lifecycle = "beta"
	Deprecated Lifecycle = "deprecated"
	Retired    Lifecycle = "retired"
)

type SourceScope string

const (
	Model SourceScope = "model"
)

type Resolution string

const (
	Pending  Resolution = "pending"
	Verified Resolution = "verified"
)

type RedirectKind string

const (
	Merge      RedirectKind = "merge"
	Rename     RedirectKind = "rename"
	Withdrawal RedirectKind = "withdrawal"
)

type SnapshotScope string

const (
	PublishedModelSpecsAllTypes SnapshotScope = "published-model-specs/all-types"
)
