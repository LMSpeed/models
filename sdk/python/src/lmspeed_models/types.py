from dataclasses import dataclass
from enum import Enum
from typing import Optional, List, Dict, Any
from datetime import datetime


@dataclass
class Counts:
    developers: int
    models: int


@dataclass
class DeveloperHistory:
    canonical_id: str
    revision: int


class DeveloperKind(Enum):
    FIXED = "fixed"
    MOVING = "moving"


@dataclass
class DeveloperSource:
    url: str
    commit: Optional[str]
    path: Optional[str]


@dataclass
class DeveloperElement:
    canonical_id: str
    kind: DeveloperKind
    namespace: str
    route_key: str
    source: DeveloperSource
    value: str
    history: Optional[List[DeveloperHistory]]
    revision: Optional[int]


@dataclass
class FamilyHistory:
    canonical_id: str
    revision: int


@dataclass
class FamilySource:
    url: str
    commit: Optional[str]
    path: Optional[str]


@dataclass
class Family:
    canonical_id: str
    kind: DeveloperKind
    namespace: str
    route_key: str
    source: FamilySource
    value: str
    history: Optional[List[FamilyHistory]]
    revision: Optional[int]


@dataclass
class ModelHistory:
    canonical_id: str
    revision: int


@dataclass
class PurpleSource:
    url: str
    commit: Optional[str]
    path: Optional[str]


@dataclass
class ModelElement:
    canonical_id: str
    kind: DeveloperKind
    namespace: str
    route_key: str
    source: PurpleSource
    value: str
    history: Optional[List[ModelHistory]]
    revision: Optional[int]


@dataclass
class Namespace:
    case_sensitive: bool


@dataclass
class Aliases:
    developers: List[DeveloperElement]
    families: List[Family]
    models: List[ModelElement]
    namespaces: Dict[str, Namespace]
    revision: int
    schema_version: float


@dataclass
class DeveloperValue:
    id: str
    name: str
    website: Optional[str]


@dataclass
class Tools:
    choice: Optional[List[str]]
    freeform: Optional[List[str]]
    search: Optional[bool]
    strict: Optional[bool]
    updates: Optional[List[str]]


@dataclass
class Capabilities:
    reasoning: Optional[bool]
    temperature: Optional[bool]
    tool_calling: Optional[bool]
    tools: Optional[Tools]
    top_k: Optional[bool]
    top_p: Optional[bool]


@dataclass
class FileFormats:
    input: Optional[List[str]]
    output: Optional[List[str]]


class Lifecycle(Enum):
    ACTIVE = "active"
    ALPHA = "alpha"
    BETA = "beta"
    DEPRECATED = "deprecated"
    RETIRED = "retired"


@dataclass
class Link:
    url: str
    label: Optional[str]
    type: Optional[str]


@dataclass
class Modalities:
    input: Optional[List[str]]
    output: Optional[List[str]]


@dataclass
class Parameters:
    active_billions: Optional[float]
    total_billions: Optional[float]


class SourceScope(Enum):
    MODEL = "model"


@dataclass
class SourceElement:
    fields: List[str]
    scope: SourceScope
    url: str
    checked_at: Optional[str]
    """Verification date or UTC timestamp, preserving source precision. observedAt records
    acquisition separately.
    """
    commit: Optional[str]
    license: Optional[str]
    observed_at: Optional[datetime]
    path: Optional[str]
    repository: Optional[str]
    source_field: Optional[str]


@dataclass
class Audio:
    channels: Optional[float]
    duration_seconds: Optional[float]
    sample_rate_hz: Optional[float]


@dataclass
class Document:
    max_bytes: Optional[float]
    max_pages: Optional[float]
    max_per_request: Optional[float]


@dataclass
class Embedding:
    dimensions: Optional[List[int]]
    max_input_tokens: Optional[float]


@dataclass
class DocumentedSize:
    height_pixels: int
    width_pixels: int


@dataclass
class Size:
    height_pixels: float
    width_pixels: float


@dataclass
class Image:
    aspect_ratios: Optional[List[str]]
    documented_sizes: Optional[List[DocumentedSize]]
    """Sizes demonstrated in official inference examples; not a declaration of an exhaustive set
    or a maximum.
    """
    editing: Optional[bool]
    generation: Optional[bool]
    max_bytes: Optional[float]
    max_height_pixels: Optional[float]
    max_per_message: Optional[float]
    max_per_request: Optional[float]
    max_pixels: Optional[float]
    max_reference_images: Optional[float]
    max_width_pixels: Optional[float]
    min_height_pixels: Optional[float]
    min_width_pixels: Optional[float]
    multi_reference: Optional[bool]
    sizes: Optional[List[Size]]


@dataclass
class Request:
    max_bytes: Optional[float]


@dataclass
class Text:
    context_window_tokens: Optional[float]
    max_input_tokens: Optional[float]
    max_output_tokens: Optional[float]
    tokenizer: Optional[str]


@dataclass
class Video:
    duration_seconds: Optional[float]
    frames_per_second: Optional[float]
    max_height_pixels: Optional[float]
    max_width_pixels: Optional[float]


@dataclass
class Specs:
    audio: Optional[Audio]
    document: Optional[Document]
    embedding: Optional[Embedding]
    image: Optional[Image]
    request: Optional[Request]
    text: Optional[Text]
    video: Optional[Video]


class Resolution(Enum):
    PENDING = "pending"
    VERIFIED = "verified"


@dataclass
class ModelsDevSource:
    fields: List[str]
    scope: SourceScope
    url: str
    checked_at: Optional[str]
    """Verification date or UTC timestamp, preserving source precision. observedAt records
    acquisition separately.
    """
    commit: Optional[str]
    license: Optional[str]
    observed_at: Optional[datetime]
    path: Optional[str]
    repository: Optional[str]
    source_field: Optional[str]


@dataclass
class ModelsDev:
    conflict: bool
    field: str
    source: ModelsDevSource
    source_field: str
    resolution: Optional[Resolution]
    value: Any


@dataclass
class UpstreamFacts:
    models_dev: List[ModelsDev]


@dataclass
class Weight:
    url: str
    format: Optional[str]
    label: Optional[str]
    quantization: Optional[str]


@dataclass
class ModelValue:
    capabilities: Capabilities
    developer_id: str
    id: str
    modalities: Modalities
    name: str
    sources: List[SourceElement]
    specs: Specs
    tasks: List[str]
    architecture: Optional[str]
    description: Optional[str]
    external_ids: Optional[Dict[str, List[str]]]
    family_id: Optional[str]
    file_formats: Optional[FileFormats]
    knowledge_cutoff: Optional[str]
    languages: Optional[List[str]]
    last_updated: Optional[str]
    lifecycle: Optional[Lifecycle]
    links: Optional[List[Link]]
    model_license: Optional[str]
    open_weights: Optional[bool]
    parameters: Optional[Parameters]
    release_date: Optional[str]
    upstream_facts: Optional[UpstreamFacts]
    weights: Optional[List[Weight]]


class RedirectKind(Enum):
    MERGE = "merge"
    RENAME = "rename"
    WITHDRAWAL = "withdrawal"


@dataclass
class Redirect:
    redirect_from: str
    kind: RedirectKind
    reason: str
    revision: int
    to: Optional[str]


@dataclass
class Upstream:
    commit: str
    id: str
    last_checked_at: datetime
    latest_checked_commit: str
    license: str
    model_count: int
    observed_at: datetime
    repository: str


@dataclass
class Data:
    aliases: Aliases
    developers: Dict[str, DeveloperValue]
    models: Dict[str, ModelValue]
    redirects: List[Redirect]
    upstreams: List[Upstream]


class SnapshotScope(Enum):
    PUBLISHED_MODEL_SPECS_ALL_TYPES = "published-model-specs/all-types"


@dataclass
class Snapshot:
    counts: Counts
    data: Data
    data_updated_at: datetime
    revision: int
    schema_version: float
    scope: SnapshotScope
    sha256: str

