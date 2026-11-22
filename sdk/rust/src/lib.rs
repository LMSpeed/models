//! Source-attributed model specifications. No request runs until a caller refreshes.
pub mod types;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sha2::{Digest, Sha256};
use std::{collections::BTreeSet, fmt, sync::OnceLock, time::Duration};
pub use types::{ModelValue as Model, Snapshot};
pub const VERSION: &str = "0.1.0";
pub const DEFAULT_URL: &str = "https://models.lmspeed.net";
#[derive(Debug, Clone)]
pub struct ModelsError {
    pub code: &'static str,
    pub message: String,
    pub candidates: Vec<String>,
}
impl ModelsError {
    fn new(code: &'static str, message: impl Into<String>) -> Self {
        Self {
            code,
            message: message.into(),
            candidates: vec![],
        }
    }
}
impl fmt::Display for ModelsError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}: {}", self.code, self.message)
    }
}
impl std::error::Error for ModelsError {}
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ResolveResult {
    pub status: String,
    pub canonical_id: Option<String>,
    pub namespace: Option<String>,
    pub candidates: Vec<String>,
}
#[derive(Default)]
pub struct Filter<'a> {
    pub task: Option<&'a str>,
    pub input: Option<&'a str>,
    pub output: Option<&'a str>,
    pub developer_id: Option<&'a str>,
}
#[derive(Debug, Clone)]
pub struct Catalog {
    pub snapshot: Snapshot,
    pub base_url: String,
    logos: Option<Value>,
}
fn relax(value: &mut Value) {
    match value {
        Value::Object(map) => {
            for (key, item) in map.iter_mut() {
                if key == "additionalProperties" && item == &Value::Bool(false) {
                    *item = Value::Bool(true)
                } else {
                    relax(item)
                }
            }
        }
        Value::Array(items) => {
            for item in items {
                relax(item)
            }
        }
        _ => {}
    }
}
static SCHEMA: OnceLock<Result<jsonschema::Validator, String>> = OnceLock::new();
fn validate(value: &Value) -> Result<(), ModelsError> {
    let schema = SCHEMA.get_or_init(|| {
        let mut schema: Value =
            serde_json::from_str(include_str!("../schema.json")).map_err(|e| e.to_string())?;
        relax(&mut schema);
        jsonschema::options()
            .should_validate_formats(true)
            .build(&schema)
            .map_err(|e| e.to_string())
    });
    let schema = schema
        .as_ref()
        .map_err(|e| ModelsError::new("invalid_contract", e.clone()))?;
    schema
        .validate(value)
        .map_err(|e| ModelsError::new("invalid_contract", e.to_string()))
}
fn normalize(value: &str, sensitive: bool) -> String {
    let value = value.trim_matches([' ', '\t', '\r', '\n']);
    if sensitive {
        value.to_owned()
    } else {
        value.to_ascii_lowercase()
    }
}
impl Catalog {
    pub fn from_json(input: &str) -> Result<Self, ModelsError> {
        let raw: Value = serde_json::from_str(input)
            .map_err(|e| ModelsError::new("invalid_json", e.to_string()))?;
        if raw.get("schemaVersion").and_then(Value::as_u64) != Some(1) {
            return Err(ModelsError::new(
                "schema_incompatible",
                "Unsupported schema major version",
            ));
        }
        validate(&raw)?;
        let bytes = serde_jcs::to_vec(&raw["data"])
            .map_err(|e| ModelsError::new("invalid_contract", e.to_string()))?;
        if raw["sha256"].as_str() != Some(&format!("{:x}", Sha256::digest(bytes))) {
            return Err(ModelsError::new(
                "invalid_contract",
                "Snapshot hash mismatch",
            ));
        }
        let snapshot: Snapshot = serde_json::from_value(raw)
            .map_err(|e| ModelsError::new("invalid_contract", e.to_string()))?;
        if snapshot.revision != snapshot.data.aliases.revision
            || snapshot.counts.models != snapshot.data.models.len() as i64
            || snapshot.counts.developers != snapshot.data.developers.len() as i64
        {
            return Err(ModelsError::new(
                "invalid_contract",
                "Count or alias revision mismatch",
            ));
        }
        for (key, model) in &snapshot.data.models {
            if key != &model.id || !snapshot.data.developers.contains_key(&model.developer_id) {
                return Err(ModelsError::new(
                    "invalid_contract",
                    "Invalid canonical identity",
                ));
            }
        }
        for alias in &snapshot.data.aliases.models {
            if !snapshot.data.models.contains_key(&alias.canonical_id) {
                return Err(ModelsError::new("invalid_contract", "Missing alias target"));
            }
        }
        Ok(Self {
            snapshot,
            base_url: DEFAULT_URL.into(),
            logos: None,
        })
    }
    pub fn revision(&self) -> i64 {
        self.snapshot.revision
    }
    pub fn data_updated_at(&self) -> &str {
        &self.snapshot.data_updated_at
    }
    pub fn resolve_model_id(&self, value: &str, namespace: Option<&str>) -> ResolveResult {
        let value = normalize(value, true);
        if namespace.is_none() && self.snapshot.data.models.contains_key(&value) {
            return ResolveResult {
                status: "resolved".into(),
                canonical_id: Some(value),
                namespace: Some("canonical".into()),
                candidates: vec![],
            };
        }
        let mut matches: Vec<_> = self
            .snapshot
            .data
            .aliases
            .models
            .iter()
            .filter(|alias| {
                let sensitive = self
                    .snapshot
                    .data
                    .aliases
                    .namespaces
                    .get(&alias.namespace)
                    .map(|rule| rule.case_sensitive)
                    .unwrap_or(true);
                namespace.map(|ns| ns == alias.namespace).unwrap_or(true)
                    && normalize(&alias.value, sensitive) == normalize(&value, sensitive)
            })
            .collect();
        if namespace.is_none() && matches.iter().any(|a| a.namespace == "global") {
            matches.retain(|a| a.namespace == "global");
        }
        let candidates: Vec<_> = matches
            .iter()
            .map(|a| a.canonical_id.clone())
            .collect::<BTreeSet<_>>()
            .into_iter()
            .collect();
        if candidates.len() != 1 {
            return ResolveResult {
                status: if candidates.is_empty() {
                    "not_found"
                } else {
                    "ambiguous"
                }
                .into(),
                canonical_id: None,
                namespace: None,
                candidates,
            };
        }
        matches.sort_by(|a, b| a.namespace.cmp(&b.namespace));
        ResolveResult {
            status: "resolved".into(),
            canonical_id: Some(candidates[0].clone()),
            namespace: Some(matches[0].namespace.clone()),
            candidates: vec![],
        }
    }
    pub fn get(&self, value: &str, namespace: Option<&str>) -> Result<&Model, ModelsError> {
        let result = self.resolve_model_id(value, namespace);
        match result.canonical_id {
            Some(id) => self
                .snapshot
                .data
                .models
                .get(&id)
                .ok_or_else(|| ModelsError::new("invalid_contract", "Missing canonical model")),
            None => Err(ModelsError {
                code: if result.status == "ambiguous" {
                    "ambiguous"
                } else {
                    "not_found"
                },
                message: value.into(),
                candidates: result.candidates,
            }),
        }
    }
    pub fn filter(&self, filter: Filter<'_>) -> Vec<&Model> {
        let mut models: Vec<_> = self
            .snapshot
            .data
            .models
            .values()
            .filter(|m| {
                filter
                    .task
                    .map(|v| m.tasks.iter().any(|task| task == v))
                    .unwrap_or(true)
                    && filter
                        .input
                        .map(|v| {
                            m.modalities
                                .input
                                .as_ref()
                                .map(|items| items.iter().any(|item| item == v))
                                .unwrap_or(false)
                        })
                        .unwrap_or(true)
                    && filter
                        .output
                        .map(|v| {
                            m.modalities
                                .output
                                .as_ref()
                                .map(|items| items.iter().any(|item| item == v))
                                .unwrap_or(false)
                        })
                        .unwrap_or(true)
                    && filter
                        .developer_id
                        .map(|v| m.developer_id == v)
                        .unwrap_or(true)
            })
            .collect();
        models.sort_by(|a, b| a.id.cmp(&b.id));
        models
    }
    pub fn icon_url(&self, value: &str, namespace: Option<&str>) -> Result<String, ModelsError> {
        Ok(format!(
            "{}/v1/models/{}.svg",
            self.base_url.trim_end_matches('/'),
            self.get(value, namespace)?.id
        ))
    }
    pub fn sources(
        &self,
        value: &str,
        field: Option<&str>,
        namespace: Option<&str>,
    ) -> Result<Vec<&types::SourceElement>, ModelsError> {
        Ok(self
            .get(value, namespace)?
            .sources
            .iter()
            .filter(|source| {
                field
                    .map(|field| {
                        source
                            .fields
                            .iter()
                            .any(|p| field == p || field.starts_with(&format!("{p}/")))
                    })
                    .unwrap_or(true)
            })
            .collect())
    }
    pub fn upstream_facts(
        &self,
        value: &str,
        namespace: Option<&str>,
    ) -> Result<Vec<&types::ModelsDev>, ModelsError> {
        Ok(self
            .get(value, namespace)?
            .upstream_facts
            .as_ref()
            .map(|facts| facts.models_dev.iter().collect())
            .unwrap_or_default())
    }
    pub fn attach_logos(&mut self, logos: Value) -> Result<(), ModelsError> {
        if logos["schemaVersion"].as_i64() != Some(1) {
            return Err(ModelsError::new(
                "schema_incompatible",
                "Unsupported logo schema",
            ));
        }
        if logos["revision"].as_i64() != Some(self.revision()) {
            return Err(ModelsError::new(
                "revision_mismatch",
                "Logo metadata belongs to another revision",
            ));
        }
        self.logos = Some(logos);
        Ok(())
    }
    pub fn icon_info(&self, value: &str, namespace: Option<&str>) -> Result<&Value, ModelsError> {
        let logos = self
            .logos
            .as_ref()
            .ok_or_else(|| ModelsError::new("not_loaded", "Load logo metadata first"))?;
        logos["models"]
            .get(&self.get(value, namespace)?.id)
            .ok_or_else(|| ModelsError::new("invalid_contract", "Missing logo metadata"))
    }
}
#[derive(Debug)]
pub struct Client {
    pub base_url: String,
    http: reqwest::Client,
    current: Option<Catalog>,
    etag: Option<String>,
}
impl Default for Client {
    fn default() -> Self {
        Self {
            base_url: DEFAULT_URL.into(),
            http: reqwest::Client::builder()
                .timeout(Duration::from_secs(30))
                .build()
                .expect("default HTTP client configuration"),
            current: None,
            etag: None,
        }
    }
}
fn http_error(error: reqwest::Error) -> ModelsError {
    ModelsError::new(
        if error.is_timeout() {
            "timeout"
        } else if error.is_decode() {
            "invalid_json"
        } else {
            "network"
        },
        error.to_string(),
    )
}
impl Client {
    pub fn new(base_url: impl Into<String>, timeout: Duration) -> Result<Self, ModelsError> {
        Ok(Self {
            base_url: base_url.into().trim_end_matches('/').to_owned(),
            http: reqwest::Client::builder()
                .timeout(timeout)
                .build()
                .map_err(http_error)?,
            current: None,
            etag: None,
        })
    }
    pub fn current(&self) -> Option<&Catalog> {
        self.current.as_ref()
    }
    async fn request(
        &self,
        path: &str,
        etag: Option<&str>,
    ) -> Result<reqwest::Response, ModelsError> {
        let mut request = self.http.get(format!("{}{path}", self.base_url));
        if let Some(etag) = etag {
            request = request.header("If-None-Match", etag);
        }
        let response = request.send().await.map_err(http_error)?;
        if response.status() != reqwest::StatusCode::NOT_MODIFIED && !response.status().is_success()
        {
            return Err(ModelsError::new(
                if response.status() == reqwest::StatusCode::NOT_FOUND {
                    "not_found"
                } else {
                    "network"
                },
                format!("HTTP {}", response.status()),
            ));
        }
        Ok(response)
    }
    pub async fn refresh(&mut self) -> Result<&Catalog, ModelsError> {
        let response = self.request("/v1/api.json", self.etag.as_deref()).await?;
        if response.status() == reqwest::StatusCode::NOT_MODIFIED {
            return self.current.as_ref().ok_or_else(|| {
                ModelsError::new("invalid_contract", "304 without a loaded catalogue")
            });
        }
        let etag = response
            .headers()
            .get("etag")
            .and_then(|v| v.to_str().ok())
            .map(str::to_owned);
        let mut candidate = Catalog::from_json(&response.text().await.map_err(http_error)?)?;
        candidate.base_url = self.base_url.clone();
        if self.current.as_ref().is_some_and(|current| {
            candidate.revision() < current.revision()
                || candidate.revision() == current.revision()
                    && candidate.snapshot.sha256 != current.snapshot.sha256
        }) {
            return Err(ModelsError::new(
                "revision_mismatch",
                "Source revision regressed or changed without a new revision",
            ));
        }
        self.current = Some(candidate);
        self.etag = etag;
        self.current
            .as_ref()
            .ok_or_else(|| ModelsError::new("invalid_contract", "Catalogue unavailable"))
    }
    pub async fn get(
        &mut self,
        value: &str,
        namespace: Option<&str>,
    ) -> Result<&Model, ModelsError> {
        if self.current.is_none() {
            self.refresh().await?;
        }
        self.current
            .as_ref()
            .ok_or_else(|| ModelsError::new("not_loaded", "Catalogue unavailable"))?
            .get(value, namespace)
    }
    pub async fn logos(&mut self) -> Result<Value, ModelsError> {
        if self.current.is_none() {
            self.refresh().await?;
        }
        let value: Value = self
            .request("/logos.json", None)
            .await?
            .json()
            .await
            .map_err(http_error)?;
        self.current
            .as_mut()
            .ok_or_else(|| ModelsError::new("not_loaded", "Catalogue unavailable"))?
            .attach_logos(value.clone())?;
        Ok(value)
    }
    pub async fn coverage(&self) -> Result<Value, ModelsError> {
        let value: Value = self
            .request("/coverage/models-dev.json", None)
            .await?
            .json()
            .await
            .map_err(http_error)?;
        if let Some(catalog) = &self.current {
            if value["revision"].as_i64() != Some(catalog.revision()) {
                return Err(ModelsError::new(
                    "revision_mismatch",
                    "Coverage belongs to another revision",
                ));
            }
        }
        Ok(value)
    }
}
