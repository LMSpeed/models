from dataclasses import dataclass
from typing import Any, Optional, List, Dict, TypeVar, Callable, Type, cast
from enum import Enum
from datetime import datetime
import dateutil.parser


T = TypeVar("T")
EnumT = TypeVar("EnumT", bound=Enum)


def from_int(x: Any) -> int:
    assert isinstance(x, int) and not isinstance(x, bool)
    return x


def from_str(x: Any) -> str:
    assert isinstance(x, str)
    return x


def from_none(x: Any) -> Any:
    assert x is None
    return x


def from_union(fs, x):
    for f in fs:
        try:
            return f(x)
        except:
            pass
    assert False


def from_list(f: Callable[[Any], T], x: Any) -> List[T]:
    assert isinstance(x, list)
    return [f(y) for y in x]


def to_enum(c: Type[EnumT], x: Any) -> EnumT:
    assert isinstance(x, c)
    return x.value


def to_class(c: Type[T], x: Any) -> dict:
    assert isinstance(x, c)
    return cast(Any, x).to_dict()


def from_bool(x: Any) -> bool:
    assert isinstance(x, bool)
    return x


def from_dict(f: Callable[[Any], T], x: Any) -> Dict[str, T]:
    assert isinstance(x, dict)
    return { k: f(v) for (k, v) in x.items() }


def from_float(x: Any) -> float:
    assert isinstance(x, (float, int)) and not isinstance(x, bool)
    return float(x)


def to_float(x: Any) -> float:
    assert isinstance(x, (int, float))
    return x


def from_datetime(x: Any) -> datetime:
    return dateutil.parser.parse(x)


@dataclass
class Counts:
    developers: int
    models: int

    @staticmethod
    def from_dict(obj: Any) -> 'Counts':
        assert isinstance(obj, dict)
        developers = from_int(obj.get("developers"))
        models = from_int(obj.get("models"))
        return Counts(developers, models)

    def to_dict(self) -> dict:
        result: dict = {}
        result["developers"] = from_int(self.developers)
        result["models"] = from_int(self.models)
        return result


@dataclass
class DeveloperHistory:
    canonical_id: str
    revision: int

    @staticmethod
    def from_dict(obj: Any) -> 'DeveloperHistory':
        assert isinstance(obj, dict)
        canonical_id = from_str(obj.get("canonicalId"))
        revision = from_int(obj.get("revision"))
        return DeveloperHistory(canonical_id, revision)

    def to_dict(self) -> dict:
        result: dict = {}
        result["canonicalId"] = from_str(self.canonical_id)
        result["revision"] = from_int(self.revision)
        return result


class DeveloperKind(Enum):
    FIXED = "fixed"
    MOVING = "moving"


@dataclass
class DeveloperSource:
    url: str
    commit: Optional[str]
    path: Optional[str]

    @staticmethod
    def from_dict(obj: Any) -> 'DeveloperSource':
        assert isinstance(obj, dict)
        url = from_str(obj.get("url"))
        commit = from_union([from_none, from_str], obj.get("commit"))
        path = from_union([from_none, from_str], obj.get("path"))
        return DeveloperSource(url, commit, path)

    def to_dict(self) -> dict:
        result: dict = {}
        result["url"] = from_str(self.url)
        if self.commit is not None:
            result["commit"] = from_union([from_none, from_str], self.commit)
        if self.path is not None:
            result["path"] = from_union([from_none, from_str], self.path)
        return result


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

    @staticmethod
    def from_dict(obj: Any) -> 'DeveloperElement':
        assert isinstance(obj, dict)
        canonical_id = from_str(obj.get("canonicalId"))
        kind = DeveloperKind(obj.get("kind"))
        namespace = from_str(obj.get("namespace"))
        route_key = from_str(obj.get("routeKey"))
        source = DeveloperSource.from_dict(obj.get("source"))
        value = from_str(obj.get("value"))
        history = from_union([lambda x: from_list(DeveloperHistory.from_dict, x), from_none], obj.get("history"))
        revision = from_union([from_int, from_none], obj.get("revision"))
        return DeveloperElement(canonical_id, kind, namespace, route_key, source, value, history, revision)

    def to_dict(self) -> dict:
        result: dict = {}
        result["canonicalId"] = from_str(self.canonical_id)
        result["kind"] = to_enum(DeveloperKind, self.kind)
        result["namespace"] = from_str(self.namespace)
        result["routeKey"] = from_str(self.route_key)
        result["source"] = to_class(DeveloperSource, self.source)
        result["value"] = from_str(self.value)
        if self.history is not None:
            result["history"] = from_union([lambda x: from_list(lambda x: to_class(DeveloperHistory, x), x), from_none], self.history)
        if self.revision is not None:
            result["revision"] = from_union([from_int, from_none], self.revision)
        return result


@dataclass
class FamilyHistory:
    canonical_id: str
    revision: int

    @staticmethod
    def from_dict(obj: Any) -> 'FamilyHistory':
        assert isinstance(obj, dict)
        canonical_id = from_str(obj.get("canonicalId"))
        revision = from_int(obj.get("revision"))
        return FamilyHistory(canonical_id, revision)

    def to_dict(self) -> dict:
        result: dict = {}
        result["canonicalId"] = from_str(self.canonical_id)
        result["revision"] = from_int(self.revision)
        return result


@dataclass
class FamilySource:
    url: str
    commit: Optional[str]
    path: Optional[str]

    @staticmethod
    def from_dict(obj: Any) -> 'FamilySource':
        assert isinstance(obj, dict)
        url = from_str(obj.get("url"))
        commit = from_union([from_none, from_str], obj.get("commit"))
        path = from_union([from_none, from_str], obj.get("path"))
        return FamilySource(url, commit, path)

    def to_dict(self) -> dict:
        result: dict = {}
        result["url"] = from_str(self.url)
        if self.commit is not None:
            result["commit"] = from_union([from_none, from_str], self.commit)
        if self.path is not None:
            result["path"] = from_union([from_none, from_str], self.path)
        return result


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

    @staticmethod
    def from_dict(obj: Any) -> 'Family':
        assert isinstance(obj, dict)
        canonical_id = from_str(obj.get("canonicalId"))
        kind = DeveloperKind(obj.get("kind"))
        namespace = from_str(obj.get("namespace"))
        route_key = from_str(obj.get("routeKey"))
        source = FamilySource.from_dict(obj.get("source"))
        value = from_str(obj.get("value"))
        history = from_union([lambda x: from_list(FamilyHistory.from_dict, x), from_none], obj.get("history"))
        revision = from_union([from_int, from_none], obj.get("revision"))
        return Family(canonical_id, kind, namespace, route_key, source, value, history, revision)

    def to_dict(self) -> dict:
        result: dict = {}
        result["canonicalId"] = from_str(self.canonical_id)
        result["kind"] = to_enum(DeveloperKind, self.kind)
        result["namespace"] = from_str(self.namespace)
        result["routeKey"] = from_str(self.route_key)
        result["source"] = to_class(FamilySource, self.source)
        result["value"] = from_str(self.value)
        if self.history is not None:
            result["history"] = from_union([lambda x: from_list(lambda x: to_class(FamilyHistory, x), x), from_none], self.history)
        if self.revision is not None:
            result["revision"] = from_union([from_int, from_none], self.revision)
        return result


@dataclass
class ModelHistory:
    canonical_id: str
    revision: int

    @staticmethod
    def from_dict(obj: Any) -> 'ModelHistory':
        assert isinstance(obj, dict)
        canonical_id = from_str(obj.get("canonicalId"))
        revision = from_int(obj.get("revision"))
        return ModelHistory(canonical_id, revision)

    def to_dict(self) -> dict:
        result: dict = {}
        result["canonicalId"] = from_str(self.canonical_id)
        result["revision"] = from_int(self.revision)
        return result


@dataclass
class PurpleSource:
    url: str
    commit: Optional[str]
    path: Optional[str]

    @staticmethod
    def from_dict(obj: Any) -> 'PurpleSource':
        assert isinstance(obj, dict)
        url = from_str(obj.get("url"))
        commit = from_union([from_none, from_str], obj.get("commit"))
        path = from_union([from_none, from_str], obj.get("path"))
        return PurpleSource(url, commit, path)

    def to_dict(self) -> dict:
        result: dict = {}
        result["url"] = from_str(self.url)
        if self.commit is not None:
            result["commit"] = from_union([from_none, from_str], self.commit)
        if self.path is not None:
            result["path"] = from_union([from_none, from_str], self.path)
        return result


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

    @staticmethod
    def from_dict(obj: Any) -> 'ModelElement':
        assert isinstance(obj, dict)
        canonical_id = from_str(obj.get("canonicalId"))
        kind = DeveloperKind(obj.get("kind"))
        namespace = from_str(obj.get("namespace"))
        route_key = from_str(obj.get("routeKey"))
        source = PurpleSource.from_dict(obj.get("source"))
        value = from_str(obj.get("value"))
        history = from_union([lambda x: from_list(ModelHistory.from_dict, x), from_none], obj.get("history"))
        revision = from_union([from_int, from_none], obj.get("revision"))
        return ModelElement(canonical_id, kind, namespace, route_key, source, value, history, revision)

    def to_dict(self) -> dict:
        result: dict = {}
        result["canonicalId"] = from_str(self.canonical_id)
        result["kind"] = to_enum(DeveloperKind, self.kind)
        result["namespace"] = from_str(self.namespace)
        result["routeKey"] = from_str(self.route_key)
        result["source"] = to_class(PurpleSource, self.source)
        result["value"] = from_str(self.value)
        if self.history is not None:
            result["history"] = from_union([lambda x: from_list(lambda x: to_class(ModelHistory, x), x), from_none], self.history)
        if self.revision is not None:
            result["revision"] = from_union([from_int, from_none], self.revision)
        return result


@dataclass
class Namespace:
    case_sensitive: bool

    @staticmethod
    def from_dict(obj: Any) -> 'Namespace':
        assert isinstance(obj, dict)
        case_sensitive = from_bool(obj.get("caseSensitive"))
        return Namespace(case_sensitive)

    def to_dict(self) -> dict:
        result: dict = {}
        result["caseSensitive"] = from_bool(self.case_sensitive)
        return result


@dataclass
class Aliases:
    developers: List[DeveloperElement]
    families: List[Family]
    models: List[ModelElement]
    namespaces: Dict[str, Namespace]
    revision: int
    schema_version: float

    @staticmethod
    def from_dict(obj: Any) -> 'Aliases':
        assert isinstance(obj, dict)
        developers = from_list(DeveloperElement.from_dict, obj.get("developers"))
        families = from_list(Family.from_dict, obj.get("families"))
        models = from_list(ModelElement.from_dict, obj.get("models"))
        namespaces = from_dict(Namespace.from_dict, obj.get("namespaces"))
        revision = from_int(obj.get("revision"))
        schema_version = from_float(obj.get("schemaVersion"))
        return Aliases(developers, families, models, namespaces, revision, schema_version)

    def to_dict(self) -> dict:
        result: dict = {}
        result["developers"] = from_list(lambda x: to_class(DeveloperElement, x), self.developers)
        result["families"] = from_list(lambda x: to_class(Family, x), self.families)
        result["models"] = from_list(lambda x: to_class(ModelElement, x), self.models)
        result["namespaces"] = from_dict(lambda x: to_class(Namespace, x), self.namespaces)
        result["revision"] = from_int(self.revision)
        result["schemaVersion"] = to_float(self.schema_version)
        return result


@dataclass
class DeveloperValue:
    id: str
    name: str
    website: Optional[str]

    @staticmethod
    def from_dict(obj: Any) -> 'DeveloperValue':
        assert isinstance(obj, dict)
        id = from_str(obj.get("id"))
        name = from_str(obj.get("name"))
        website = from_union([from_none, from_str], obj.get("website"))
        return DeveloperValue(id, name, website)

    def to_dict(self) -> dict:
        result: dict = {}
        result["id"] = from_str(self.id)
        result["name"] = from_str(self.name)
        result["website"] = from_union([from_none, from_str], self.website)
        return result


@dataclass
class Tools:
    choice: Optional[List[str]]
    freeform: Optional[List[str]]
    search: Optional[bool]
    strict: Optional[bool]
    updates: Optional[List[str]]

    @staticmethod
    def from_dict(obj: Any) -> 'Tools':
        assert isinstance(obj, dict)
        choice = from_union([lambda x: from_list(from_str, x), from_none], obj.get("choice"))
        freeform = from_union([lambda x: from_list(from_str, x), from_none], obj.get("freeform"))
        search = from_union([from_bool, from_none], obj.get("search"))
        strict = from_union([from_bool, from_none], obj.get("strict"))
        updates = from_union([lambda x: from_list(from_str, x), from_none], obj.get("updates"))
        return Tools(choice, freeform, search, strict, updates)

    def to_dict(self) -> dict:
        result: dict = {}
        if self.choice is not None:
            result["choice"] = from_union([lambda x: from_list(from_str, x), from_none], self.choice)
        if self.freeform is not None:
            result["freeform"] = from_union([lambda x: from_list(from_str, x), from_none], self.freeform)
        if self.search is not None:
            result["search"] = from_union([from_bool, from_none], self.search)
        if self.strict is not None:
            result["strict"] = from_union([from_bool, from_none], self.strict)
        if self.updates is not None:
            result["updates"] = from_union([lambda x: from_list(from_str, x), from_none], self.updates)
        return result


@dataclass
class Capabilities:
    reasoning: Optional[bool]
    temperature: Optional[bool]
    tool_calling: Optional[bool]
    tools: Optional[Tools]
    top_k: Optional[bool]
    top_p: Optional[bool]

    @staticmethod
    def from_dict(obj: Any) -> 'Capabilities':
        assert isinstance(obj, dict)
        reasoning = from_union([from_bool, from_none], obj.get("reasoning"))
        temperature = from_union([from_bool, from_none], obj.get("temperature"))
        tool_calling = from_union([from_bool, from_none], obj.get("toolCalling"))
        tools = from_union([Tools.from_dict, from_none], obj.get("tools"))
        top_k = from_union([from_bool, from_none], obj.get("topK"))
        top_p = from_union([from_bool, from_none], obj.get("topP"))
        return Capabilities(reasoning, temperature, tool_calling, tools, top_k, top_p)

    def to_dict(self) -> dict:
        result: dict = {}
        result["reasoning"] = from_union([from_bool, from_none], self.reasoning)
        if self.temperature is not None:
            result["temperature"] = from_union([from_bool, from_none], self.temperature)
        result["toolCalling"] = from_union([from_bool, from_none], self.tool_calling)
        if self.tools is not None:
            result["tools"] = from_union([lambda x: to_class(Tools, x), from_none], self.tools)
        if self.top_k is not None:
            result["topK"] = from_union([from_bool, from_none], self.top_k)
        if self.top_p is not None:
            result["topP"] = from_union([from_bool, from_none], self.top_p)
        return result


@dataclass
class FileFormats:
    input: Optional[List[str]]
    output: Optional[List[str]]

    @staticmethod
    def from_dict(obj: Any) -> 'FileFormats':
        assert isinstance(obj, dict)
        input = from_union([lambda x: from_list(from_str, x), from_none], obj.get("input"))
        output = from_union([lambda x: from_list(from_str, x), from_none], obj.get("output"))
        return FileFormats(input, output)

    def to_dict(self) -> dict:
        result: dict = {}
        result["input"] = from_union([lambda x: from_list(from_str, x), from_none], self.input)
        result["output"] = from_union([lambda x: from_list(from_str, x), from_none], self.output)
        return result


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

    @staticmethod
    def from_dict(obj: Any) -> 'Link':
        assert isinstance(obj, dict)
        url = from_str(obj.get("url"))
        label = from_union([from_none, from_str], obj.get("label"))
        type = from_union([from_none, from_str], obj.get("type"))
        return Link(url, label, type)

    def to_dict(self) -> dict:
        result: dict = {}
        result["url"] = from_str(self.url)
        if self.label is not None:
            result["label"] = from_union([from_none, from_str], self.label)
        if self.type is not None:
            result["type"] = from_union([from_none, from_str], self.type)
        return result


@dataclass
class Modalities:
    input: Optional[List[str]]
    output: Optional[List[str]]

    @staticmethod
    def from_dict(obj: Any) -> 'Modalities':
        assert isinstance(obj, dict)
        input = from_union([lambda x: from_list(from_str, x), from_none], obj.get("input"))
        output = from_union([lambda x: from_list(from_str, x), from_none], obj.get("output"))
        return Modalities(input, output)

    def to_dict(self) -> dict:
        result: dict = {}
        result["input"] = from_union([lambda x: from_list(from_str, x), from_none], self.input)
        result["output"] = from_union([lambda x: from_list(from_str, x), from_none], self.output)
        return result


@dataclass
class Parameters:
    active_billions: Optional[float]
    total_billions: Optional[float]

    @staticmethod
    def from_dict(obj: Any) -> 'Parameters':
        assert isinstance(obj, dict)
        active_billions = from_union([from_float, from_none], obj.get("activeBillions"))
        total_billions = from_union([from_float, from_none], obj.get("totalBillions"))
        return Parameters(active_billions, total_billions)

    def to_dict(self) -> dict:
        result: dict = {}
        if self.active_billions is not None:
            result["activeBillions"] = from_union([to_float, from_none], self.active_billions)
        if self.total_billions is not None:
            result["totalBillions"] = from_union([to_float, from_none], self.total_billions)
        return result


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

    @staticmethod
    def from_dict(obj: Any) -> 'SourceElement':
        assert isinstance(obj, dict)
        fields = from_list(from_str, obj.get("fields"))
        scope = SourceScope(obj.get("scope"))
        url = from_str(obj.get("url"))
        checked_at = from_union([from_none, from_str], obj.get("checkedAt"))
        commit = from_union([from_none, from_str], obj.get("commit"))
        license = from_union([from_none, from_str], obj.get("license"))
        observed_at = from_union([from_datetime, from_none], obj.get("observedAt"))
        path = from_union([from_none, from_str], obj.get("path"))
        repository = from_union([from_none, from_str], obj.get("repository"))
        source_field = from_union([from_none, from_str], obj.get("sourceField"))
        return SourceElement(fields, scope, url, checked_at, commit, license, observed_at, path, repository, source_field)

    def to_dict(self) -> dict:
        result: dict = {}
        result["fields"] = from_list(from_str, self.fields)
        result["scope"] = to_enum(SourceScope, self.scope)
        result["url"] = from_str(self.url)
        if self.checked_at is not None:
            result["checkedAt"] = from_union([from_none, from_str], self.checked_at)
        if self.commit is not None:
            result["commit"] = from_union([from_none, from_str], self.commit)
        if self.license is not None:
            result["license"] = from_union([from_none, from_str], self.license)
        if self.observed_at is not None:
            result["observedAt"] = from_union([lambda x: x.isoformat(), from_none], self.observed_at)
        if self.path is not None:
            result["path"] = from_union([from_none, from_str], self.path)
        if self.repository is not None:
            result["repository"] = from_union([from_none, from_str], self.repository)
        if self.source_field is not None:
            result["sourceField"] = from_union([from_none, from_str], self.source_field)
        return result


@dataclass
class Audio:
    channels: Optional[float]
    duration_seconds: Optional[float]
    sample_rate_hz: Optional[float]

    @staticmethod
    def from_dict(obj: Any) -> 'Audio':
        assert isinstance(obj, dict)
        channels = from_union([from_float, from_none], obj.get("channels"))
        duration_seconds = from_union([from_float, from_none], obj.get("durationSeconds"))
        sample_rate_hz = from_union([from_float, from_none], obj.get("sampleRateHz"))
        return Audio(channels, duration_seconds, sample_rate_hz)

    def to_dict(self) -> dict:
        result: dict = {}
        if self.channels is not None:
            result["channels"] = from_union([to_float, from_none], self.channels)
        if self.duration_seconds is not None:
            result["durationSeconds"] = from_union([to_float, from_none], self.duration_seconds)
        if self.sample_rate_hz is not None:
            result["sampleRateHz"] = from_union([to_float, from_none], self.sample_rate_hz)
        return result


@dataclass
class Document:
    max_bytes: Optional[float]
    max_pages: Optional[float]
    max_per_request: Optional[float]

    @staticmethod
    def from_dict(obj: Any) -> 'Document':
        assert isinstance(obj, dict)
        max_bytes = from_union([from_float, from_none], obj.get("maxBytes"))
        max_pages = from_union([from_float, from_none], obj.get("maxPages"))
        max_per_request = from_union([from_float, from_none], obj.get("maxPerRequest"))
        return Document(max_bytes, max_pages, max_per_request)

    def to_dict(self) -> dict:
        result: dict = {}
        if self.max_bytes is not None:
            result["maxBytes"] = from_union([to_float, from_none], self.max_bytes)
        if self.max_pages is not None:
            result["maxPages"] = from_union([to_float, from_none], self.max_pages)
        if self.max_per_request is not None:
            result["maxPerRequest"] = from_union([to_float, from_none], self.max_per_request)
        return result


@dataclass
class Embedding:
    dimensions: Optional[List[int]]
    max_input_tokens: Optional[float]

    @staticmethod
    def from_dict(obj: Any) -> 'Embedding':
        assert isinstance(obj, dict)
        dimensions = from_union([lambda x: from_list(from_int, x), from_none], obj.get("dimensions"))
        max_input_tokens = from_union([from_float, from_none], obj.get("maxInputTokens"))
        return Embedding(dimensions, max_input_tokens)

    def to_dict(self) -> dict:
        result: dict = {}
        if self.dimensions is not None:
            result["dimensions"] = from_union([lambda x: from_list(from_int, x), from_none], self.dimensions)
        if self.max_input_tokens is not None:
            result["maxInputTokens"] = from_union([to_float, from_none], self.max_input_tokens)
        return result


@dataclass
class DocumentedSize:
    height_pixels: int
    width_pixels: int

    @staticmethod
    def from_dict(obj: Any) -> 'DocumentedSize':
        assert isinstance(obj, dict)
        height_pixels = from_int(obj.get("heightPixels"))
        width_pixels = from_int(obj.get("widthPixels"))
        return DocumentedSize(height_pixels, width_pixels)

    def to_dict(self) -> dict:
        result: dict = {}
        result["heightPixels"] = from_int(self.height_pixels)
        result["widthPixels"] = from_int(self.width_pixels)
        return result


@dataclass
class Size:
    height_pixels: float
    width_pixels: float

    @staticmethod
    def from_dict(obj: Any) -> 'Size':
        assert isinstance(obj, dict)
        height_pixels = from_float(obj.get("heightPixels"))
        width_pixels = from_float(obj.get("widthPixels"))
        return Size(height_pixels, width_pixels)

    def to_dict(self) -> dict:
        result: dict = {}
        result["heightPixels"] = to_float(self.height_pixels)
        result["widthPixels"] = to_float(self.width_pixels)
        return result


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

    @staticmethod
    def from_dict(obj: Any) -> 'Image':
        assert isinstance(obj, dict)
        aspect_ratios = from_union([lambda x: from_list(from_str, x), from_none], obj.get("aspectRatios"))
        documented_sizes = from_union([lambda x: from_list(DocumentedSize.from_dict, x), from_none], obj.get("documentedSizes"))
        editing = from_union([from_bool, from_none], obj.get("editing"))
        generation = from_union([from_bool, from_none], obj.get("generation"))
        max_bytes = from_union([from_float, from_none], obj.get("maxBytes"))
        max_height_pixels = from_union([from_float, from_none], obj.get("maxHeightPixels"))
        max_per_message = from_union([from_float, from_none], obj.get("maxPerMessage"))
        max_per_request = from_union([from_float, from_none], obj.get("maxPerRequest"))
        max_pixels = from_union([from_float, from_none], obj.get("maxPixels"))
        max_reference_images = from_union([from_float, from_none], obj.get("maxReferenceImages"))
        max_width_pixels = from_union([from_float, from_none], obj.get("maxWidthPixels"))
        min_height_pixels = from_union([from_float, from_none], obj.get("minHeightPixels"))
        min_width_pixels = from_union([from_float, from_none], obj.get("minWidthPixels"))
        multi_reference = from_union([from_bool, from_none], obj.get("multiReference"))
        sizes = from_union([lambda x: from_list(Size.from_dict, x), from_none], obj.get("sizes"))
        return Image(aspect_ratios, documented_sizes, editing, generation, max_bytes, max_height_pixels, max_per_message, max_per_request, max_pixels, max_reference_images, max_width_pixels, min_height_pixels, min_width_pixels, multi_reference, sizes)

    def to_dict(self) -> dict:
        result: dict = {}
        if self.aspect_ratios is not None:
            result["aspectRatios"] = from_union([lambda x: from_list(from_str, x), from_none], self.aspect_ratios)
        if self.documented_sizes is not None:
            result["documentedSizes"] = from_union([lambda x: from_list(lambda x: to_class(DocumentedSize, x), x), from_none], self.documented_sizes)
        if self.editing is not None:
            result["editing"] = from_union([from_bool, from_none], self.editing)
        if self.generation is not None:
            result["generation"] = from_union([from_bool, from_none], self.generation)
        if self.max_bytes is not None:
            result["maxBytes"] = from_union([to_float, from_none], self.max_bytes)
        if self.max_height_pixels is not None:
            result["maxHeightPixels"] = from_union([to_float, from_none], self.max_height_pixels)
        if self.max_per_message is not None:
            result["maxPerMessage"] = from_union([to_float, from_none], self.max_per_message)
        if self.max_per_request is not None:
            result["maxPerRequest"] = from_union([to_float, from_none], self.max_per_request)
        if self.max_pixels is not None:
            result["maxPixels"] = from_union([to_float, from_none], self.max_pixels)
        if self.max_reference_images is not None:
            result["maxReferenceImages"] = from_union([to_float, from_none], self.max_reference_images)
        if self.max_width_pixels is not None:
            result["maxWidthPixels"] = from_union([to_float, from_none], self.max_width_pixels)
        if self.min_height_pixels is not None:
            result["minHeightPixels"] = from_union([to_float, from_none], self.min_height_pixels)
        if self.min_width_pixels is not None:
            result["minWidthPixels"] = from_union([to_float, from_none], self.min_width_pixels)
        if self.multi_reference is not None:
            result["multiReference"] = from_union([from_bool, from_none], self.multi_reference)
        if self.sizes is not None:
            result["sizes"] = from_union([lambda x: from_list(lambda x: to_class(Size, x), x), from_none], self.sizes)
        return result


@dataclass
class Request:
    max_bytes: Optional[float]

    @staticmethod
    def from_dict(obj: Any) -> 'Request':
        assert isinstance(obj, dict)
        max_bytes = from_union([from_float, from_none], obj.get("maxBytes"))
        return Request(max_bytes)

    def to_dict(self) -> dict:
        result: dict = {}
        if self.max_bytes is not None:
            result["maxBytes"] = from_union([to_float, from_none], self.max_bytes)
        return result


@dataclass
class Text:
    context_window_tokens: Optional[float]
    max_input_tokens: Optional[float]
    max_output_tokens: Optional[float]
    tokenizer: Optional[str]

    @staticmethod
    def from_dict(obj: Any) -> 'Text':
        assert isinstance(obj, dict)
        context_window_tokens = from_union([from_float, from_none], obj.get("contextWindowTokens"))
        max_input_tokens = from_union([from_float, from_none], obj.get("maxInputTokens"))
        max_output_tokens = from_union([from_float, from_none], obj.get("maxOutputTokens"))
        tokenizer = from_union([from_none, from_str], obj.get("tokenizer"))
        return Text(context_window_tokens, max_input_tokens, max_output_tokens, tokenizer)

    def to_dict(self) -> dict:
        result: dict = {}
        if self.context_window_tokens is not None:
            result["contextWindowTokens"] = from_union([to_float, from_none], self.context_window_tokens)
        if self.max_input_tokens is not None:
            result["maxInputTokens"] = from_union([to_float, from_none], self.max_input_tokens)
        if self.max_output_tokens is not None:
            result["maxOutputTokens"] = from_union([to_float, from_none], self.max_output_tokens)
        if self.tokenizer is not None:
            result["tokenizer"] = from_union([from_none, from_str], self.tokenizer)
        return result


@dataclass
class Video:
    duration_seconds: Optional[float]
    frames_per_second: Optional[float]
    max_height_pixels: Optional[float]
    max_width_pixels: Optional[float]

    @staticmethod
    def from_dict(obj: Any) -> 'Video':
        assert isinstance(obj, dict)
        duration_seconds = from_union([from_float, from_none], obj.get("durationSeconds"))
        frames_per_second = from_union([from_float, from_none], obj.get("framesPerSecond"))
        max_height_pixels = from_union([from_float, from_none], obj.get("maxHeightPixels"))
        max_width_pixels = from_union([from_float, from_none], obj.get("maxWidthPixels"))
        return Video(duration_seconds, frames_per_second, max_height_pixels, max_width_pixels)

    def to_dict(self) -> dict:
        result: dict = {}
        if self.duration_seconds is not None:
            result["durationSeconds"] = from_union([to_float, from_none], self.duration_seconds)
        if self.frames_per_second is not None:
            result["framesPerSecond"] = from_union([to_float, from_none], self.frames_per_second)
        if self.max_height_pixels is not None:
            result["maxHeightPixels"] = from_union([to_float, from_none], self.max_height_pixels)
        if self.max_width_pixels is not None:
            result["maxWidthPixels"] = from_union([to_float, from_none], self.max_width_pixels)
        return result


@dataclass
class Specs:
    audio: Optional[Audio]
    document: Optional[Document]
    embedding: Optional[Embedding]
    image: Optional[Image]
    request: Optional[Request]
    text: Optional[Text]
    video: Optional[Video]

    @staticmethod
    def from_dict(obj: Any) -> 'Specs':
        assert isinstance(obj, dict)
        audio = from_union([Audio.from_dict, from_none], obj.get("audio"))
        document = from_union([Document.from_dict, from_none], obj.get("document"))
        embedding = from_union([Embedding.from_dict, from_none], obj.get("embedding"))
        image = from_union([Image.from_dict, from_none], obj.get("image"))
        request = from_union([Request.from_dict, from_none], obj.get("request"))
        text = from_union([Text.from_dict, from_none], obj.get("text"))
        video = from_union([Video.from_dict, from_none], obj.get("video"))
        return Specs(audio, document, embedding, image, request, text, video)

    def to_dict(self) -> dict:
        result: dict = {}
        if self.audio is not None:
            result["audio"] = from_union([lambda x: to_class(Audio, x), from_none], self.audio)
        if self.document is not None:
            result["document"] = from_union([lambda x: to_class(Document, x), from_none], self.document)
        if self.embedding is not None:
            result["embedding"] = from_union([lambda x: to_class(Embedding, x), from_none], self.embedding)
        if self.image is not None:
            result["image"] = from_union([lambda x: to_class(Image, x), from_none], self.image)
        if self.request is not None:
            result["request"] = from_union([lambda x: to_class(Request, x), from_none], self.request)
        if self.text is not None:
            result["text"] = from_union([lambda x: to_class(Text, x), from_none], self.text)
        if self.video is not None:
            result["video"] = from_union([lambda x: to_class(Video, x), from_none], self.video)
        return result


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

    @staticmethod
    def from_dict(obj: Any) -> 'ModelsDevSource':
        assert isinstance(obj, dict)
        fields = from_list(from_str, obj.get("fields"))
        scope = SourceScope(obj.get("scope"))
        url = from_str(obj.get("url"))
        checked_at = from_union([from_none, from_str], obj.get("checkedAt"))
        commit = from_union([from_none, from_str], obj.get("commit"))
        license = from_union([from_none, from_str], obj.get("license"))
        observed_at = from_union([from_datetime, from_none], obj.get("observedAt"))
        path = from_union([from_none, from_str], obj.get("path"))
        repository = from_union([from_none, from_str], obj.get("repository"))
        source_field = from_union([from_none, from_str], obj.get("sourceField"))
        return ModelsDevSource(fields, scope, url, checked_at, commit, license, observed_at, path, repository, source_field)

    def to_dict(self) -> dict:
        result: dict = {}
        result["fields"] = from_list(from_str, self.fields)
        result["scope"] = to_enum(SourceScope, self.scope)
        result["url"] = from_str(self.url)
        if self.checked_at is not None:
            result["checkedAt"] = from_union([from_none, from_str], self.checked_at)
        if self.commit is not None:
            result["commit"] = from_union([from_none, from_str], self.commit)
        if self.license is not None:
            result["license"] = from_union([from_none, from_str], self.license)
        if self.observed_at is not None:
            result["observedAt"] = from_union([lambda x: x.isoformat(), from_none], self.observed_at)
        if self.path is not None:
            result["path"] = from_union([from_none, from_str], self.path)
        if self.repository is not None:
            result["repository"] = from_union([from_none, from_str], self.repository)
        if self.source_field is not None:
            result["sourceField"] = from_union([from_none, from_str], self.source_field)
        return result


@dataclass
class ModelsDev:
    conflict: bool
    field: str
    source: ModelsDevSource
    source_field: str
    resolution: Optional[Resolution]
    value: Any

    @staticmethod
    def from_dict(obj: Any) -> 'ModelsDev':
        assert isinstance(obj, dict)
        conflict = from_bool(obj.get("conflict"))
        field = from_str(obj.get("field"))
        source = ModelsDevSource.from_dict(obj.get("source"))
        source_field = from_str(obj.get("sourceField"))
        resolution = from_union([Resolution, from_none], obj.get("resolution"))
        value = obj.get("value")
        return ModelsDev(conflict, field, source, source_field, resolution, value)

    def to_dict(self) -> dict:
        result: dict = {}
        result["conflict"] = from_bool(self.conflict)
        result["field"] = from_str(self.field)
        result["source"] = to_class(ModelsDevSource, self.source)
        result["sourceField"] = from_str(self.source_field)
        if self.resolution is not None:
            result["resolution"] = from_union([lambda x: to_enum(Resolution, x), from_none], self.resolution)
        result["value"] = self.value
        return result


@dataclass
class UpstreamFacts:
    models_dev: List[ModelsDev]

    @staticmethod
    def from_dict(obj: Any) -> 'UpstreamFacts':
        assert isinstance(obj, dict)
        models_dev = from_list(ModelsDev.from_dict, obj.get("modelsDev"))
        return UpstreamFacts(models_dev)

    def to_dict(self) -> dict:
        result: dict = {}
        result["modelsDev"] = from_list(lambda x: to_class(ModelsDev, x), self.models_dev)
        return result


@dataclass
class Weight:
    url: str
    format: Optional[str]
    label: Optional[str]
    quantization: Optional[str]

    @staticmethod
    def from_dict(obj: Any) -> 'Weight':
        assert isinstance(obj, dict)
        url = from_str(obj.get("url"))
        format = from_union([from_none, from_str], obj.get("format"))
        label = from_union([from_none, from_str], obj.get("label"))
        quantization = from_union([from_none, from_str], obj.get("quantization"))
        return Weight(url, format, label, quantization)

    def to_dict(self) -> dict:
        result: dict = {}
        result["url"] = from_str(self.url)
        if self.format is not None:
            result["format"] = from_union([from_none, from_str], self.format)
        if self.label is not None:
            result["label"] = from_union([from_none, from_str], self.label)
        if self.quantization is not None:
            result["quantization"] = from_union([from_none, from_str], self.quantization)
        return result


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

    @staticmethod
    def from_dict(obj: Any) -> 'ModelValue':
        assert isinstance(obj, dict)
        capabilities = Capabilities.from_dict(obj.get("capabilities"))
        developer_id = from_str(obj.get("developerId"))
        id = from_str(obj.get("id"))
        modalities = Modalities.from_dict(obj.get("modalities"))
        name = from_str(obj.get("name"))
        sources = from_list(SourceElement.from_dict, obj.get("sources"))
        specs = Specs.from_dict(obj.get("specs"))
        tasks = from_list(from_str, obj.get("tasks"))
        architecture = from_union([from_none, from_str], obj.get("architecture"))
        description = from_union([from_none, from_str], obj.get("description"))
        external_ids = from_union([lambda x: from_dict(lambda x: from_list(from_str, x), x), from_none], obj.get("externalIds"))
        family_id = from_union([from_none, from_str], obj.get("familyId"))
        file_formats = from_union([FileFormats.from_dict, from_none], obj.get("fileFormats"))
        knowledge_cutoff = from_union([from_none, from_str], obj.get("knowledgeCutoff"))
        languages = from_union([lambda x: from_list(from_str, x), from_none], obj.get("languages"))
        last_updated = from_union([from_none, from_str], obj.get("lastUpdated"))
        lifecycle = from_union([Lifecycle, from_none], obj.get("lifecycle"))
        links = from_union([lambda x: from_list(Link.from_dict, x), from_none], obj.get("links"))
        model_license = from_union([from_none, from_str], obj.get("modelLicense"))
        open_weights = from_union([from_bool, from_none], obj.get("openWeights"))
        parameters = from_union([Parameters.from_dict, from_none], obj.get("parameters"))
        release_date = from_union([from_none, from_str], obj.get("releaseDate"))
        upstream_facts = from_union([UpstreamFacts.from_dict, from_none], obj.get("upstreamFacts"))
        weights = from_union([lambda x: from_list(Weight.from_dict, x), from_none], obj.get("weights"))
        return ModelValue(capabilities, developer_id, id, modalities, name, sources, specs, tasks, architecture, description, external_ids, family_id, file_formats, knowledge_cutoff, languages, last_updated, lifecycle, links, model_license, open_weights, parameters, release_date, upstream_facts, weights)

    def to_dict(self) -> dict:
        result: dict = {}
        result["capabilities"] = to_class(Capabilities, self.capabilities)
        result["developerId"] = from_str(self.developer_id)
        result["id"] = from_str(self.id)
        result["modalities"] = to_class(Modalities, self.modalities)
        result["name"] = from_str(self.name)
        result["sources"] = from_list(lambda x: to_class(SourceElement, x), self.sources)
        result["specs"] = to_class(Specs, self.specs)
        result["tasks"] = from_list(from_str, self.tasks)
        if self.architecture is not None:
            result["architecture"] = from_union([from_none, from_str], self.architecture)
        if self.description is not None:
            result["description"] = from_union([from_none, from_str], self.description)
        if self.external_ids is not None:
            result["externalIds"] = from_union([lambda x: from_dict(lambda x: from_list(from_str, x), x), from_none], self.external_ids)
        if self.family_id is not None:
            result["familyId"] = from_union([from_none, from_str], self.family_id)
        if self.file_formats is not None:
            result["fileFormats"] = from_union([lambda x: to_class(FileFormats, x), from_none], self.file_formats)
        if self.knowledge_cutoff is not None:
            result["knowledgeCutoff"] = from_union([from_none, from_str], self.knowledge_cutoff)
        if self.languages is not None:
            result["languages"] = from_union([lambda x: from_list(from_str, x), from_none], self.languages)
        if self.last_updated is not None:
            result["lastUpdated"] = from_union([from_none, from_str], self.last_updated)
        if self.lifecycle is not None:
            result["lifecycle"] = from_union([lambda x: to_enum(Lifecycle, x), from_none], self.lifecycle)
        if self.links is not None:
            result["links"] = from_union([lambda x: from_list(lambda x: to_class(Link, x), x), from_none], self.links)
        if self.model_license is not None:
            result["modelLicense"] = from_union([from_none, from_str], self.model_license)
        if self.open_weights is not None:
            result["openWeights"] = from_union([from_bool, from_none], self.open_weights)
        if self.parameters is not None:
            result["parameters"] = from_union([lambda x: to_class(Parameters, x), from_none], self.parameters)
        if self.release_date is not None:
            result["releaseDate"] = from_union([from_none, from_str], self.release_date)
        if self.upstream_facts is not None:
            result["upstreamFacts"] = from_union([lambda x: to_class(UpstreamFacts, x), from_none], self.upstream_facts)
        if self.weights is not None:
            result["weights"] = from_union([lambda x: from_list(lambda x: to_class(Weight, x), x), from_none], self.weights)
        return result


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

    @staticmethod
    def from_dict(obj: Any) -> 'Redirect':
        assert isinstance(obj, dict)
        redirect_from = from_str(obj.get("from"))
        kind = RedirectKind(obj.get("kind"))
        reason = from_str(obj.get("reason"))
        revision = from_int(obj.get("revision"))
        to = from_union([from_none, from_str], obj.get("to"))
        return Redirect(redirect_from, kind, reason, revision, to)

    def to_dict(self) -> dict:
        result: dict = {}
        result["from"] = from_str(self.redirect_from)
        result["kind"] = to_enum(RedirectKind, self.kind)
        result["reason"] = from_str(self.reason)
        result["revision"] = from_int(self.revision)
        result["to"] = from_union([from_none, from_str], self.to)
        return result


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

    @staticmethod
    def from_dict(obj: Any) -> 'Upstream':
        assert isinstance(obj, dict)
        commit = from_str(obj.get("commit"))
        id = from_str(obj.get("id"))
        last_checked_at = from_datetime(obj.get("lastCheckedAt"))
        latest_checked_commit = from_str(obj.get("latestCheckedCommit"))
        license = from_str(obj.get("license"))
        model_count = from_int(obj.get("modelCount"))
        observed_at = from_datetime(obj.get("observedAt"))
        repository = from_str(obj.get("repository"))
        return Upstream(commit, id, last_checked_at, latest_checked_commit, license, model_count, observed_at, repository)

    def to_dict(self) -> dict:
        result: dict = {}
        result["commit"] = from_str(self.commit)
        result["id"] = from_str(self.id)
        result["lastCheckedAt"] = self.last_checked_at.isoformat()
        result["latestCheckedCommit"] = from_str(self.latest_checked_commit)
        result["license"] = from_str(self.license)
        result["modelCount"] = from_int(self.model_count)
        result["observedAt"] = self.observed_at.isoformat()
        result["repository"] = from_str(self.repository)
        return result


@dataclass
class Data:
    aliases: Aliases
    developers: Dict[str, DeveloperValue]
    models: Dict[str, ModelValue]
    redirects: List[Redirect]
    upstreams: List[Upstream]

    @staticmethod
    def from_dict(obj: Any) -> 'Data':
        assert isinstance(obj, dict)
        aliases = Aliases.from_dict(obj.get("aliases"))
        developers = from_dict(DeveloperValue.from_dict, obj.get("developers"))
        models = from_dict(ModelValue.from_dict, obj.get("models"))
        redirects = from_list(Redirect.from_dict, obj.get("redirects"))
        upstreams = from_list(Upstream.from_dict, obj.get("upstreams"))
        return Data(aliases, developers, models, redirects, upstreams)

    def to_dict(self) -> dict:
        result: dict = {}
        result["aliases"] = to_class(Aliases, self.aliases)
        result["developers"] = from_dict(lambda x: to_class(DeveloperValue, x), self.developers)
        result["models"] = from_dict(lambda x: to_class(ModelValue, x), self.models)
        result["redirects"] = from_list(lambda x: to_class(Redirect, x), self.redirects)
        result["upstreams"] = from_list(lambda x: to_class(Upstream, x), self.upstreams)
        return result


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

    @staticmethod
    def from_dict(obj: Any) -> 'Snapshot':
        assert isinstance(obj, dict)
        counts = Counts.from_dict(obj.get("counts"))
        data = Data.from_dict(obj.get("data"))
        data_updated_at = from_datetime(obj.get("dataUpdatedAt"))
        revision = from_int(obj.get("revision"))
        schema_version = from_float(obj.get("schemaVersion"))
        scope = SnapshotScope(obj.get("scope"))
        sha256 = from_str(obj.get("sha256"))
        return Snapshot(counts, data, data_updated_at, revision, schema_version, scope, sha256)

    def to_dict(self) -> dict:
        result: dict = {}
        result["counts"] = to_class(Counts, self.counts)
        result["data"] = to_class(Data, self.data)
        result["dataUpdatedAt"] = self.data_updated_at.isoformat()
        result["revision"] = from_int(self.revision)
        result["schemaVersion"] = to_float(self.schema_version)
        result["scope"] = to_enum(SnapshotScope, self.scope)
        result["sha256"] = from_str(self.sha256)
        return result


def snapshot_from_dict(s: Any) -> Snapshot:
    return Snapshot.from_dict(s)


def snapshot_to_dict(x: Snapshot) -> Any:
    return to_class(Snapshot, x)

