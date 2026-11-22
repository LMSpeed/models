use lmspeed_models::Catalog;
#[test]
fn user_loads_the_shared_catalogue_before_resolving_model_identity() {
    // Given the exact same cross-language catalogue used by every SDK.
    let raw = include_str!("../testdata/valid.json");
    // When a consumer loads it without a network connection.
    let result = Catalog::from_json(raw);
    // Then the valid model catalogue is available for offline reads.
    assert!(result.is_ok(), "valid shared contract was rejected");
}
#[test]
fn user_resolves_every_shared_alias_case_without_network_access() {
    // Given the shared model directory, nulls and source-specific alias cases.
    let catalog = Catalog::from_json(include_str!("../testdata/valid.json")).unwrap();
    let cases: serde_json::Value =
        serde_json::from_str(include_str!("../testdata/resolution.json")).unwrap();
    // When each registered or ambiguous name is resolved offline.
    for case in cases.as_array().unwrap() {
        let result =
            catalog.resolve_model_id(case["input"].as_str().unwrap(), case["namespace"].as_str());
        // Then every language sees the same canonical model or candidate set.
        assert_eq!(result.status, case["status"].as_str().unwrap());
        if let Some(id) = case["canonicalId"].as_str() {
            assert_eq!(result.canonical_id.as_deref(), Some(id));
        }
        if case["candidates"].is_array() {
            assert_eq!(
                serde_json::to_value(result.candidates).unwrap(),
                case["candidates"]
            );
        }
    }
    let model = catalog.get("Example LLM", None).unwrap();
    assert_eq!(
        model.specs.text.as_ref().unwrap().context_window_tokens,
        Some(0.0)
    );
    assert_eq!(model.specs.text.as_ref().unwrap().max_output_tokens, None);
    assert_eq!(model.capabilities.reasoning, Some(false));
    assert_eq!(model.knowledge_cutoff.as_deref(), Some("2026-01"));
}
#[tokio::test]
async fn user_revalidates_real_http_and_keeps_the_loaded_revision_after_failure() {
    use lmspeed_models::{Client, Filter};
    use std::time::Duration;
    // Given an HTTP success boundary verified against the static preview.
    let base = match std::env::var("MODEL_TEST_BASE_URL") {
        Ok(value) => value,
        Err(_) => return,
    };
    let mut client = Client::new(format!("{base}/valid"), Duration::from_secs(30)).unwrap();
    // When the caller explicitly refreshes, revalidates and loads metadata.
    assert_eq!(client.refresh().await.unwrap().revision(), 1);
    assert_eq!(client.refresh().await.unwrap().revision(), 1);
    assert_eq!(
        client.get("Example LLM", None).await.unwrap().id,
        "fixture-llm"
    );
    client.logos().await.unwrap();
    assert_eq!(client.coverage().await.unwrap()["revision"], 1);
    // Then nulls, source references, icon fallbacks and offline filters remain consistent.
    let catalog = client.current().unwrap();
    assert_eq!(
        catalog.icon_info("Example LLM", None).unwrap()["fallback"],
        true
    );
    assert_eq!(
        catalog
            .sources("Example LLM", Some("/specs/text/contextWindowTokens"), None)
            .unwrap()
            .len(),
        1
    );
    assert!(catalog
        .sources("Example LLM", Some("/missing"), None)
        .unwrap()
        .is_empty());
    assert!(catalog
        .upstream_facts("Example LLM", None)
        .unwrap()
        .is_empty());
    assert_eq!(
        catalog
            .filter(Filter {
                task: Some("text-generation"),
                input: Some("image"),
                output: Some("text"),
                developer_id: Some("fixture-lab")
            })
            .len(),
        1
    );
    assert!(catalog
        .filter(Filter {
            task: Some("missing"),
            ..Default::default()
        })
        .is_empty());
    assert!(catalog
        .filter(Filter {
            input: Some("missing"),
            ..Default::default()
        })
        .is_empty());
    assert!(catalog
        .filter(Filter {
            output: Some("missing"),
            ..Default::default()
        })
        .is_empty());
    assert!(catalog
        .filter(Filter {
            developer_id: Some("missing"),
            ..Default::default()
        })
        .is_empty());
    assert_eq!(
        catalog.icon_url("Example LLM", None).unwrap(),
        format!("{base}/valid/v1/models/fixture-llm.svg")
    );
    assert_eq!(catalog.get("shared", None).unwrap_err().code, "ambiguous");
    assert_eq!(catalog.get("missing", None).unwrap_err().code, "not_found");
    let mut flaky = Client::new(format!("{base}/flaky-rust"), Duration::from_secs(30)).unwrap();
    flaky.refresh().await.unwrap();
    assert_eq!(flaky.refresh().await.unwrap_err().code, "invalid_json");
    assert_eq!(flaky.current().unwrap().revision(), 1);
    for (path, code) in [
        ("missing", "not_found"),
        ("invalid", "invalid_json"),
        ("incompatible", "schema_incompatible"),
        ("bad-hash", "invalid_contract"),
    ] {
        let mut client = Client::new(format!("{base}/{path}"), Duration::from_secs(30)).unwrap();
        assert_eq!(client.refresh().await.unwrap_err().code, code);
    }
    let mut slow = Client::new(format!("{base}/slow"), Duration::from_millis(5)).unwrap();
    assert_eq!(slow.refresh().await.unwrap_err().code, "timeout");
    let mut extended = Client::new(format!("{base}/extension"), Duration::from_secs(30)).unwrap();
    assert_eq!(extended.refresh().await.unwrap().revision(), 1);
}

#[test]
fn user_reads_actual_static_catalogue() {
    // Given the actual SSG dataset supplied by the SDK integration launcher.
    let Ok(path) = std::env::var("MODELS_DATA_FILE") else {
        return;
    };
    let raw = std::fs::read_to_string(path).unwrap();
    // When an offline Rust consumer loads the complete exported catalogue.
    let catalog = lmspeed_models::Catalog::from_json(&raw).unwrap();
    // Then all canonical source identities resolve with the declared model count.
    assert_eq!(
        catalog.snapshot.counts.models as usize,
        catalog.snapshot.data.models.len()
    );
    for alias in &catalog.snapshot.data.aliases.models {
        assert_eq!(
            catalog
                .resolve_model_id(&alias.value, Some(&alias.namespace))
                .canonical_id
                .as_deref(),
            Some(alias.canonical_id.as_str())
        );
    }
}

#[tokio::test]
async fn user_keeps_newer_loaded_specs_when_the_source_regresses() {
    // Given a real HTTP source serving a newer snapshot before an older valid revision.
    let base = std::env::var("MODEL_TEST_BASE_URL").unwrap();
    let mut client = lmspeed_models::Client::new(
        format!("{base}/rewind-rust"),
        std::time::Duration::from_secs(5),
    )
    .unwrap();
    let previous = client.refresh().await.unwrap().revision();
    // When the caller explicitly refreshes across that regression.
    let error = client
        .refresh()
        .await
        .expect_err("A revision regression must be explicit");
    // Then the loaded catalogue stays available and the failure is distinguishable.
    assert_eq!(error.code, "revision_mismatch");
    assert_eq!(client.current().unwrap().revision(), previous);
}
