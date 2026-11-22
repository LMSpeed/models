package models

import (
	"encoding/json"
	"os"
	"testing"
)

func TestUserResolvesTheSharedCatalogueOffline(t *testing.T) {
	// Given the shared cross-language catalogue and source-partitioned aliases.
	raw, err := os.ReadFile("testdata/valid.json")
	if err != nil {
		t.Fatal(err)
	}
	catalog, err := LoadJSON(raw)
	if err != nil {
		t.Fatal(err)
	}
	casesRaw, err := os.ReadFile("testdata/resolution.json")
	if err != nil {
		t.Fatal(err)
	}
	var cases []struct {
		Input       string   `json:"input"`
		Namespace   string   `json:"namespace"`
		Status      string   `json:"status"`
		CanonicalID string   `json:"canonicalId"`
		Candidates  []string `json:"candidates"`
	}
	if err = json.Unmarshal(casesRaw, &cases); err != nil {
		t.Fatal(err)
	}
	// When an offline consumer resolves every explicitly registered identifier.
	for _, item := range cases {
		resolved := catalog.ResolveModelID(item.Input, item.Namespace)
		// Then the result matches all other languages without guessing an identity.
		if resolved.Status != item.Status || resolved.CanonicalID != item.CanonicalID {
			t.Fatalf("%s: %#v", item.Input, resolved)
		}
		if item.Candidates != nil {
			a, _ := json.Marshal(resolved.Candidates)
			b, _ := json.Marshal(item.Candidates)
			if string(a) != string(b) {
				t.Fatalf("candidate mismatch: %s != %s", a, b)
			}
		}
	}
	model, err := catalog.Get("Example LLM", "")
	if err != nil {
		t.Fatal(err)
	}
	if model.Specs.Text.ContextWindowTokens == nil || *model.Specs.Text.ContextWindowTokens != 0 || model.Specs.Text.MaxOutputTokens != nil {
		t.Fatal("zero or null contract changed")
	}
	if model.Capabilities.Reasoning == nil || *model.Capabilities.Reasoning {
		t.Fatal("explicit false contract changed")
	}
}

func TestUserReadsActualStaticCatalogue(t *testing.T) {
	// Given the actual SSG catalogue supplied by the integration launcher.
	path := os.Getenv("MODELS_DATA_FILE")
	if path == "" {
		t.Skip("Actual SSG dataset is supplied by the SDK integration launcher")
	}
	raw, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	// When an offline consumer loads every real model and registered source identity.
	catalog, err := LoadJSON(raw)
	if err != nil {
		t.Fatal(err)
	}
	// Then the manifest counts and every canonical alias target remain exact.
	if catalog.Snapshot.Counts.Models != int64(len(catalog.Snapshot.Data.Models)) {
		t.Fatal("Actual model count mismatch")
	}
	for _, alias := range catalog.Snapshot.Data.Aliases.Models {
		if catalog.ResolveModelID(alias.Value, alias.Namespace).CanonicalID != alias.CanonicalID {
			t.Fatal("Actual alias target mismatch")
		}
	}
}
