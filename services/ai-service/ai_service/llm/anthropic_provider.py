"""
Anthropic (Claude) LLM provider.

Reads:
  LLM_MODEL         — model name (default: claude-sonnet-4-6)
  ANTHROPIC_API_KEY — API key (required when LLM_PROVIDER=anthropic)

Anthropic's messages API separates the system prompt from the turn history;
this provider handles that split automatically.
"""
from __future__ import annotations

import os
from typing import List

import anthropic

from .base import LLMMessage, LLMProvider, LLMResponse


class AnthropicProvider(LLMProvider):
    def __init__(self) -> None:
        self._model = os.getenv("LLM_MODEL", "claude-sonnet-4-6")
        self._client = anthropic.AsyncAnthropic(
            api_key=os.getenv("ANTHROPIC_API_KEY", ""),
        )

    @property
    def gen_ai_system(self) -> str:
        return "anthropic"

    @property
    def model(self) -> str:
        return self._model

    async def chat(self, messages: List[LLMMessage]) -> LLMResponse:
        # Anthropic requires the system prompt as a top-level field, not a message.
        system_parts: List[str] = []
        turn_messages: List[dict] = []

        for m in messages:
            if m.role == "system":
                system_parts.append(m.content)
            else:
                turn_messages.append({"role": m.role, "content": m.content})

        kwargs: dict = {
            "model": self._model,
            "max_tokens": 1024,
            "messages": turn_messages,
        }
        if system_parts:
            kwargs["system"] = "\n\n".join(system_parts)

        response = await self._client.messages.create(**kwargs)
        content = response.content[0].text if response.content else ""

        return LLMResponse(
            content=content,
            model=response.model,
            input_tokens=response.usage.input_tokens,
            output_tokens=response.usage.output_tokens,
            gen_ai_system="anthropic",
            finish_reason=response.stop_reason or "stop",
        )
