// Example code that deserializes and serializes the model.
// extern crate serde;
// #[macro_use]
// extern crate serde_derive;
// extern crate serde_json;
//
// use generated_module::Snapshot;
//
// fn main() {
//     let json = r#"{"answer": 42}"#;
//     let model: Snapshot = serde_json::from_str(&json).unwrap();
// }

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Snapshot {
    pub counts: Counts,

    pub data: Data,

    pub data_updated_at: String,

    pub revision: i64,

    pub schema_version: f64,

    pub scope: SnapshotScope,

    pub sha256: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Counts {
    pub developers: i64,

    pub models: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Data {
    pub aliases: Aliases,

    pub developers: HashMap<String, DeveloperValue>,

    pub models: HashMap<String, ModelValue>,

    pub redirects: Vec<Redirect>,

    pub upstreams: Vec<Upstream>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Aliases {
    pub developers: Vec<DeveloperElement>,

    pub families: Vec<Family>,

    pub models: Vec<ModelElement>,

    pub namespaces: HashMap<String, Namespace>,

    pub revision: i64,

    pub schema_version: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeveloperElement {
    pub canonical_id: String,

    pub history: Option<Vec<DeveloperHistory>>,

    pub kind: DeveloperKind,

    pub namespace: String,

    pub revision: Option<i64>,

    pub route_key: String,

    pub source: DeveloperSource,

    pub value: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeveloperHistory {
    pub canonical_id: String,

    pub revision: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum DeveloperKind {
    Fixed,

    Moving,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeveloperSource {
    pub commit: Option<String>,

    pub path: Option<String>,

    pub url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Family {
    pub canonical_id: String,

    pub history: Option<Vec<FamilyHistory>>,

    pub kind: DeveloperKind,

    pub namespace: String,

    pub revision: Option<i64>,

    pub route_key: String,

    pub source: FamilySource,

    pub value: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FamilyHistory {
    pub canonical_id: String,

    pub revision: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FamilySource {
    pub commit: Option<String>,

    pub path: Option<String>,

    pub url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelElement {
    pub canonical_id: String,

    pub history: Option<Vec<ModelHistory>>,

    pub kind: DeveloperKind,

    pub namespace: String,

    pub revision: Option<i64>,

    pub route_key: String,

    pub source: PurpleSource,

    pub value: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelHistory {
    pub canonical_id: String,

    pub revision: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PurpleSource {
    pub commit: Option<String>,

    pub path: Option<String>,

    pub url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Namespace {
    pub case_sensitive: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeveloperValue {
    pub id: String,

    pub name: String,

    pub website: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelValue {
    pub architecture: Option<String>,

    pub capabilities: Capabilities,

    pub description: Option<String>,

    pub developer_id: String,

    pub external_ids: Option<HashMap<String, Vec<String>>>,

    pub family_id: Option<String>,

    pub file_formats: Option<FileFormats>,

    pub id: String,

    pub knowledge_cutoff: Option<String>,

    pub languages: Option<Vec<String>>,

    pub last_updated: Option<String>,

    pub lifecycle: Option<Lifecycle>,

    pub links: Option<Vec<Link>>,

    pub modalities: Modalities,

    pub model_license: Option<String>,

    pub name: String,

    pub open_weights: Option<bool>,

    pub parameters: Option<Parameters>,

    pub release_date: Option<String>,

    pub sources: Vec<SourceElement>,

    pub specs: Specs,

    pub tasks: Vec<String>,

    pub upstream_facts: Option<UpstreamFacts>,

    pub weights: Option<Vec<Weight>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Capabilities {
    pub reasoning: Option<bool>,

    pub temperature: Option<bool>,

    pub tool_calling: Option<bool>,

    pub tools: Option<Tools>,

    pub top_k: Option<bool>,

    pub top_p: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Tools {
    pub choice: Option<Vec<String>>,

    pub freeform: Option<Vec<String>>,

    pub search: Option<bool>,

    pub strict: Option<bool>,

    pub updates: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileFormats {
    pub input: Option<Vec<String>>,

    pub output: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Lifecycle {
    Active,

    Alpha,

    Beta,

    Deprecated,

    Retired,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Link {
    pub label: Option<String>,

    #[serde(rename = "type")]
    pub link_type: Option<String>,

    pub url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Modalities {
    pub input: Option<Vec<String>>,

    pub output: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Parameters {
    pub active_billions: Option<f64>,

    pub total_billions: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceElement {
    /// Verification date or UTC timestamp, preserving source precision. observedAt records
    /// acquisition separately.
    pub checked_at: Option<String>,

    pub commit: Option<String>,

    pub fields: Vec<String>,

    pub license: Option<String>,

    pub observed_at: Option<String>,

    pub path: Option<String>,

    pub repository: Option<String>,

    pub scope: SourceScope,

    pub source_field: Option<String>,

    pub url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SourceScope {
    Model,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Specs {
    pub audio: Option<Audio>,

    pub document: Option<Document>,

    pub embedding: Option<Embedding>,

    pub image: Option<Image>,

    pub request: Option<Request>,

    pub text: Option<Text>,

    pub video: Option<Video>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Audio {
    pub channels: Option<f64>,

    pub duration_seconds: Option<f64>,

    pub sample_rate_hz: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Document {
    pub max_bytes: Option<f64>,

    pub max_pages: Option<f64>,

    pub max_per_request: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Embedding {
    pub dimensions: Option<Vec<i64>>,

    pub max_input_tokens: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Image {
    pub aspect_ratios: Option<Vec<String>>,

    /// Sizes demonstrated in official inference examples; not a declaration of an exhaustive set
    /// or a maximum.
    pub documented_sizes: Option<Vec<DocumentedSize>>,

    pub editing: Option<bool>,

    pub generation: Option<bool>,

    pub max_bytes: Option<f64>,

    pub max_height_pixels: Option<f64>,

    pub max_per_message: Option<f64>,

    pub max_per_request: Option<f64>,

    pub max_pixels: Option<f64>,

    pub max_reference_images: Option<f64>,

    pub max_width_pixels: Option<f64>,

    pub min_height_pixels: Option<f64>,

    pub min_width_pixels: Option<f64>,

    pub multi_reference: Option<bool>,

    pub sizes: Option<Vec<Size>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DocumentedSize {
    pub height_pixels: i64,

    pub width_pixels: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Size {
    pub height_pixels: f64,

    pub width_pixels: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Request {
    pub max_bytes: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Text {
    pub context_window_tokens: Option<f64>,

    pub max_input_tokens: Option<f64>,

    pub max_output_tokens: Option<f64>,

    pub tokenizer: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Video {
    pub duration_seconds: Option<f64>,

    pub frames_per_second: Option<f64>,

    pub max_height_pixels: Option<f64>,

    pub max_width_pixels: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpstreamFacts {
    pub models_dev: Vec<ModelsDev>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelsDev {
    pub conflict: bool,

    pub field: String,

    pub resolution: Option<Resolution>,

    pub source: ModelsDevSource,

    pub source_field: String,

    pub value: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Resolution {
    Pending,

    Verified,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelsDevSource {
    /// Verification date or UTC timestamp, preserving source precision. observedAt records
    /// acquisition separately.
    pub checked_at: Option<String>,

    pub commit: Option<String>,

    pub fields: Vec<String>,

    pub license: Option<String>,

    pub observed_at: Option<String>,

    pub path: Option<String>,

    pub repository: Option<String>,

    pub scope: SourceScope,

    pub source_field: Option<String>,

    pub url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Weight {
    pub format: Option<String>,

    pub label: Option<String>,

    pub quantization: Option<String>,

    pub url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Redirect {
    pub from: String,

    pub kind: RedirectKind,

    pub reason: String,

    pub revision: i64,

    pub to: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RedirectKind {
    Merge,

    Rename,

    Withdrawal,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Upstream {
    pub commit: String,

    pub id: String,

    pub last_checked_at: String,

    pub latest_checked_commit: String,

    pub license: String,

    pub model_count: i64,

    pub observed_at: String,

    pub repository: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SnapshotScope {
    #[serde(rename = "published-model-specs/all-types")]
    PublishedModelSpecsAllTypes,
}
