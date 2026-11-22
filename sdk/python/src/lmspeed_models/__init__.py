"""Read LMSpeed model specifications. Importing this package never uses the network."""
from __future__ import annotations
from dataclasses import dataclass, field
from datetime import datetime
from importlib.resources import files
import hashlib
import json
from typing import Any
from urllib.parse import quote
import httpx
import jsonschema
import rfc8785
from .types import Snapshot, ModelValue as Model, SourceElement, ModelsDev
from .codec import decode
__version__ = "0.1.0"
DEFAULT_URL = "https://models.lmspeed.net"
class ModelsError(Exception):
    def __init__(self, code: str, message: str, candidates: list[str] | None = None):
        super().__init__(message)
        self.code = code
        self.candidates = candidates or []
@dataclass(frozen=True)
class Resolution:
    status: str
    canonical_id: str | None = None
    namespace: str | None = None
    candidates: list[str] = field(default_factory=list)
def _normalize(value: str, sensitive: bool) -> str:
    value = value.strip(" \t\r\n")
    return value if sensitive else value.translate(str.maketrans("ABCDEFGHIJKLMNOPQRSTUVWXYZ", "abcdefghijklmnopqrstuvwxyz"))
def _compatible_schema(value: Any) -> Any:
    if isinstance(value, dict):
        return {key: (True if key == "additionalProperties" and item is False else _compatible_schema(item)) for key, item in value.items()}
    if isinstance(value, list):
        return [_compatible_schema(item) for item in value]
    return value
class Catalog:
    def __init__(self, raw: dict[str, Any], snapshot: Snapshot, base_url: str):
        self.raw = raw
        self.snapshot = snapshot
        self.base_url = base_url.rstrip("/")
        self._logos: dict[str, Any] | None = None
    @classmethod
    def from_json(cls, value: str | bytes | dict[str, Any], base_url: str = DEFAULT_URL) -> Catalog:
        try:
            raw = json.loads(value) if isinstance(value, (str, bytes)) else value
        except (ValueError, UnicodeError) as error:
            raise ModelsError("invalid_json", "Catalogue is not valid JSON") from error
        if not isinstance(raw, dict):
            raise ModelsError("invalid_contract", "Catalogue must be an object")
        if raw.get("schemaVersion") != 1:
            raise ModelsError("schema_incompatible", "Unsupported schema major version")
        try:
            schema = json.loads(files(__package__).joinpath("schema.json").read_text())
            jsonschema.Draft202012Validator(_compatible_schema(schema)).validate(raw)
            if hashlib.sha256(rfc8785.dumps(raw["data"])).hexdigest() != raw["sha256"]:
                raise ValueError("Snapshot hash mismatch")
            snapshot = decode(Snapshot, raw)
            if snapshot.revision != snapshot.data.aliases.revision or snapshot.counts.models != len(snapshot.data.models) or snapshot.counts.developers != len(snapshot.data.developers):
                raise ValueError("Snapshot counts or alias revision mismatch")
            for key, model in snapshot.data.models.items():
                if model.id != key or model.developer_id not in snapshot.data.developers:
                    raise ValueError("Invalid canonical identity")
            for alias in raw["data"]["aliases"]["models"]:
                if alias["canonicalId"] not in snapshot.data.models:
                    raise ValueError("Invalid alias target")
            return cls(raw, snapshot, base_url)
        except (ValueError, TypeError, KeyError, AssertionError, jsonschema.ValidationError) as error:
            raise ModelsError("invalid_contract", f"Invalid model catalogue: {error}") from error
    @property
    def revision(self) -> int:
        return self.snapshot.revision
    @property
    def data_updated_at(self) -> datetime:
        return self.snapshot.data_updated_at
    @property
    def models(self) -> dict[str, Model]:
        return self.snapshot.data.models
    def resolve_model_id(self, value: str, namespace: str | None = None) -> Resolution:
        value = _normalize(value, True)
        if namespace is None and value in self.models:
            return Resolution("resolved", value, "canonical")
        index = self.raw["data"]["aliases"]
        matches = []
        for alias in index["models"]:
            if namespace is not None and alias["namespace"] != namespace:
                continue
            sensitive = index["namespaces"].get(alias["namespace"], {}).get("caseSensitive", True)
            if _normalize(alias["value"], sensitive) == _normalize(value, sensitive):
                matches.append(alias)
        global_matches = [alias for alias in matches if alias["namespace"] == "global"] if namespace is None else []
        matches = global_matches or matches
        candidates = sorted({alias["canonicalId"] for alias in matches})
        if len(candidates) != 1:
            return Resolution("ambiguous" if candidates else "not_found", candidates=candidates)
        alias = sorted(matches, key=lambda item: item["namespace"])[0]
        return Resolution("resolved", candidates[0], alias["namespace"])
    def get(self, value: str, namespace: str | None = None) -> Model:
        result = self.resolve_model_id(value, namespace)
        if result.status != "resolved":
            raise ModelsError(result.status, f"{result.status}: {value}", result.candidates)
        return self.models[result.canonical_id]
    def filter(self, *, task: str | None = None, input: str | None = None, output: str | None = None, developer_id: str | None = None) -> list[Model]:
        return [model for model in self.models.values() if (task is None or task in model.tasks) and (input is None or input in (model.modalities.input or [])) and (output is None or output in (model.modalities.output or [])) and (developer_id is None or model.developer_id == developer_id)]
    def icon_url(self, value: str, namespace: str | None = None) -> str:
        return f"{self.base_url}/v1/models/{quote(self.get(value, namespace).id, safe='')}.svg"
    def sources(self, value: str, field: str | None = None, namespace: str | None = None) -> list[SourceElement]:
        sources = self.get(value, namespace).sources
        return sources if field is None else [source for source in sources if any(field == path or field.startswith(path + "/") for path in source.fields)]
    def upstream_facts(self, value: str, namespace: str | None = None) -> list[ModelsDev]:
        facts = self.get(value, namespace).upstream_facts
        return facts.models_dev if facts else []
    def attach_logos(self, logos: dict[str, Any]) -> None:
        if logos.get("schemaVersion") != 1:
            raise ModelsError("schema_incompatible", "Unsupported logo schema")
        if logos.get("revision") != self.revision:
            raise ModelsError("revision_mismatch", "Logo metadata belongs to another revision")
        self._logos = logos
    def icon_info(self, value: str, namespace: str | None = None) -> dict[str, Any]:
        if self._logos is None:
            raise ModelsError("not_loaded", "Load logo metadata before reading its source")
        try:
            return self._logos["models"][self.get(value, namespace).id]
        except KeyError as error:
            raise ModelsError("invalid_contract", "Missing logo metadata") from error
def _json(response: httpx.Response) -> Any:
    try:
        return response.json()
    except ValueError as error:
        raise ModelsError("invalid_json", "Response is not valid JSON") from error
def _status(response: httpx.Response) -> None:
    if response.status_code != 304 and not response.is_success:
        raise ModelsError("not_found" if response.status_code == 404 else "network", f"HTTP {response.status_code}")
class Client:
    def __init__(self, base_url: str = DEFAULT_URL, timeout: float = 30):
        if timeout <= 0:
            raise ValueError("timeout must be positive")
        self.base_url, self.timeout = base_url.rstrip("/"), timeout
        self.current: Catalog | None = None
        self.etag: str | None = None
    def _request(self, path: str, headers: dict[str, str] | None = None) -> httpx.Response:
        try:
            response = httpx.get(self.base_url + path, headers=headers, timeout=self.timeout)
            _status(response)
            return response
        except httpx.TimeoutException as error:
            raise ModelsError("timeout", "Request timed out") from error
        except httpx.HTTPError as error:
            raise ModelsError("network", str(error)) from error
    def refresh(self) -> Catalog:
        response = self._request("/v1/api.json", {"If-None-Match": self.etag} if self.etag else {})
        if response.status_code == 304:
            if self.current is None:
                raise ModelsError("invalid_contract", "304 without a loaded catalogue")
            return self.current
        candidate = Catalog.from_json(_json(response), self.base_url)
        if self.current and (candidate.revision < self.current.revision or candidate.revision == self.current.revision and candidate.snapshot.sha256 != self.current.snapshot.sha256):
            raise ModelsError("revision_mismatch", "Source revision regressed or changed without a new revision")
        self.current, self.etag = candidate, response.headers.get("etag")
        return candidate
    def get(self, value: str, namespace: str | None = None) -> Model:
        return (self.current or self.refresh()).get(value, namespace)
    def logos(self) -> dict[str, Any]:
        catalog = self.current or self.refresh()
        value = _json(self._request("/logos.json"))
        catalog.attach_logos(value)
        return value
    def coverage(self) -> dict[str, Any]:
        value = _json(self._request("/coverage/models-dev.json"))
        if self.current and value.get("revision") != self.current.revision:
            raise ModelsError("revision_mismatch", "Coverage belongs to another revision")
        return value
class AsyncClient:
    def __init__(self, base_url: str = DEFAULT_URL, timeout: float = 30):
        if timeout <= 0:
            raise ValueError("timeout must be positive")
        self.base_url = base_url.rstrip("/")
        self.current: Catalog | None = None
        self.etag: str | None = None
        self._http = httpx.AsyncClient(timeout=timeout)
    async def _request(self, path: str, headers: dict[str, str] | None = None) -> httpx.Response:
        try:
            response = await self._http.get(self.base_url + path, headers=headers)
            _status(response)
            return response
        except httpx.TimeoutException as error:
            raise ModelsError("timeout", "Request timed out") from error
        except httpx.HTTPError as error:
            raise ModelsError("network", str(error)) from error
    async def refresh(self) -> Catalog:
        response = await self._request("/v1/api.json", {"If-None-Match": self.etag} if self.etag else {})
        if response.status_code == 304:
            if self.current is None:
                raise ModelsError("invalid_contract", "304 without a loaded catalogue")
            return self.current
        candidate = Catalog.from_json(_json(response), self.base_url)
        if self.current and (candidate.revision < self.current.revision or candidate.revision == self.current.revision and candidate.snapshot.sha256 != self.current.snapshot.sha256):
            raise ModelsError("revision_mismatch", "Source revision regressed or changed without a new revision")
        self.current, self.etag = candidate, response.headers.get("etag")
        return candidate
    async def get(self, value: str, namespace: str | None = None) -> Model:
        return (self.current or await self.refresh()).get(value, namespace)
    async def logos(self) -> dict[str, Any]:
        catalog = self.current or await self.refresh()
        value = _json(await self._request("/logos.json"))
        catalog.attach_logos(value)
        return value
    async def coverage(self) -> dict[str, Any]:
        value = _json(await self._request("/coverage/models-dev.json"))
        if self.current and value.get("revision") != self.current.revision:
            raise ModelsError("revision_mismatch", "Coverage belongs to another revision")
        return value
    async def aclose(self) -> None:
        await self._http.aclose()
    async def __aenter__(self) -> AsyncClient:
        return self
    async def __aexit__(self, *_args: object) -> None:
        await self.aclose()
