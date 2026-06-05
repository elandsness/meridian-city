"""
Abstract LLM provider interface.

Each concrete provider (OpenAI, Anthropic, Ollama) implements LLMProvider
and returns a standardised LLMResponse that carries the token counts and
model identity needed for OTel GenAI semantic convention attributes.
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import List, Optional


@dataclass
class LLMMessage:
    role: str      # "system" | "user" | "assistant"
    content: str


@dataclass
class LLMResponse:
    content: str
    model: str               # actual model used (may differ from requested)
    input_tokens: int
    output_tokens: int
    gen_ai_system: str       # "openai" | "anthropic" | "ollama"
    finish_reason: str = "stop"


class LLMProvider(ABC):
    """Common interface for all LLM backends."""

    @property
    @abstractmethod
    def gen_ai_system(self) -> str:
        """OTel gen_ai.system attribute value."""

    @property
    @abstractmethod
    def model(self) -> str:
        """The model name requested (gen_ai.request.model)."""

    @abstractmethod
    async def chat(self, messages: List[LLMMessage]) -> LLMResponse:
        """Send a list of messages and return the assistant response."""
