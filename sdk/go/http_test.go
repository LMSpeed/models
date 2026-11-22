package models

import (
	"context"
	"encoding/json"
	"errors"
	"os"
	"testing"
	"time"
)

func requireCode(t *testing.T, err error, code string) {
	t.Helper()
	var modelError *Error
	if !errors.As(err, &modelError) || modelError.Code != code {
		t.Fatalf("want %s, got %v", code, err)
	}
}
func TestUserRefreshesAndRevalidatesRealHTTPWithoutLosingLoadedData(t *testing.T) {
	// Given the verified static contract served over a real isolated HTTP boundary.
	base := os.Getenv("MODEL_TEST_BASE_URL")
	if base == "" {
		t.Skip("HTTP contract service is configured by test-sdks")
	}
	ctx := context.Background()
	client := NewClient(base + "/valid")
	// When the caller loads, revalidates and requests source and logo metadata.
	first, err := client.Refresh(ctx)
	if err != nil {
		t.Fatal(err)
	}
	second, err := client.Refresh(ctx)
	if err != nil || second != first {
		t.Fatalf("304 lost catalogue: %v", err)
	}
	model, err := client.Get(ctx, "Example LLM", "")
	if err != nil || model.ID != "fixture-llm" {
		t.Fatal(err)
	}
	logos, err := client.Logos(ctx)
	if err != nil || logos.Revision != first.Snapshot.Revision {
		t.Fatal(err)
	}
	info, err := first.IconInfo("Example LLM", "")
	if err != nil || !info.Fallback {
		t.Fatal(err)
	}
	report, err := client.Coverage(ctx)
	if err != nil || report["revision"] != float64(1) {
		t.Fatal(err)
	}
	// Then the same revision exposes its explicit sources and offline filters.
	sources, err := first.Sources("Example LLM", "/specs/text/contextWindowTokens", "")
	if err != nil || len(sources) != 1 {
		t.Fatal(err)
	}
	if sources, err = first.Sources("Example LLM", "/missing", ""); err != nil || len(sources) != 0 {
		t.Fatal(err)
	}
	facts, err := first.UpstreamFacts("Example LLM", "")
	if err != nil || len(facts) != 0 {
		t.Fatal(err)
	}
	if got := first.Filter(Filter{Task: "text-generation", Input: "image", Output: "text", DeveloperID: "fixture-lab"}); len(got) != 1 {
		t.Fatal("filter mismatch")
	}
	if got := first.Filter(Filter{Task: "missing"}); len(got) != 0 {
		t.Fatal("unknown task matched")
	}
	if got := first.Filter(Filter{Input: "missing"}); len(got) != 0 {
		t.Fatal("unknown input matched")
	}
	if got := first.Filter(Filter{Output: "missing"}); len(got) != 0 {
		t.Fatal("unknown output matched")
	}
	if got := first.Filter(Filter{DeveloperID: "missing"}); len(got) != 0 {
		t.Fatal("unknown developer matched")
	}
	icon, err := first.IconURL("Example LLM", "")
	if err != nil || icon != base+"/valid/v1/models/fixture-llm.svg" {
		t.Fatal(icon, err)
	}
	_, err = first.Get("shared", "")
	requireCode(t, err, "ambiguous")
	_, err = first.Get("missing", "")
	requireCode(t, err, "not_found")
	requireCode(t, first.AttachLogos(&LogoIndex{SchemaVersion: 2}), "schema_incompatible")
	requireCode(t, first.AttachLogos(&LogoIndex{SchemaVersion: 1, Revision: 2}), "revision_mismatch")
	flaky := NewClient(base + "/flaky-go")
	previous, err := flaky.Refresh(ctx)
	if err != nil {
		t.Fatal(err)
	}
	_, err = flaky.Refresh(ctx)
	requireCode(t, err, "invalid_json")
	if flaky.Current() != previous {
		t.Fatal("refresh failure erased cache")
	}
	for path, code := range map[string]string{"missing": "not_found", "invalid": "invalid_json", "incompatible": "schema_incompatible", "bad-hash": "invalid_contract"} {
		_, err = NewClient(base + "/" + path).Refresh(ctx)
		requireCode(t, err, code)
	}
	slow := NewClient(base + "/slow")
	slow.HTTPClient.Timeout = 5 * time.Millisecond
	_, err = slow.Refresh(ctx)
	requireCode(t, err, "timeout")
	cancelled, cancel := context.WithCancel(ctx)
	cancel()
	_, err = client.Refresh(cancelled)
	requireCode(t, err, "cancelled")
	extended, err := NewClient(base + "/extension").Refresh(ctx)
	if err != nil || extended.Snapshot.Revision != 1 {
		t.Fatal(err)
	}
	var null interface{}
	if err = json.Unmarshal([]byte("null"), &null); err != nil {
		t.Fatal(err)
	}
}
