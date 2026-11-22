"""Decode schema-validated JSON into generated dataclasses without a second validator."""
from dataclasses import fields, is_dataclass
from datetime import datetime
from enum import Enum
from typing import Any, Union, get_args, get_origin, get_type_hints

def _json_key(name: str) -> str:
    head, *tail = name.rstrip("_").split("_")
    return head + "".join(part[:1].upper() + part[1:] for part in tail)

def decode(kind: Any, value: Any) -> Any:
    if value is None or kind is Any:
        return value
    origin = get_origin(kind)
    args = get_args(kind)
    if origin is Union:
        choices = [choice for choice in args if choice is not type(None)]
        return decode(choices[0], value)
    if origin is list:
        return [decode(args[0], item) for item in value]
    if origin is dict:
        return {key: decode(args[1], item) for key, item in value.items()}
    if is_dataclass(kind):
        hints = get_type_hints(kind)
        return kind(**{field.name: decode(hints[field.name], value.get(_json_key(field.name))) for field in fields(kind)})
    if kind is datetime:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    if isinstance(kind, type) and issubclass(kind, Enum):
        return kind(value)
    return value
