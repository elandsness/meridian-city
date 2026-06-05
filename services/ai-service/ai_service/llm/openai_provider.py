"""
OpenAI LLM provider.

Reads:
  LLM_MODEL        — model name (default: gpt-4o)
  OPENAI_API_KEY   — API key (required when LLM_PROVIDER=openai)
  OPENAI_BASE_URL  — base URL (default: https://api.openai.com/v1)
"""
from __future__ import annotations

import os
from typing import List

from openai import AsyncOpenAI

from .base import LLMMessage, LLMProvider, LLMResponse


class OpenAIProvider(LLMProvider):
    def __init__(self) -> None:
        self._model = os.getenv("LLM_MODEL", "gpt-4o")
        self._client = AsyncOpenAI(
            api_key=os.getenv("OPENAI_API_KEY", ""),
            base_url=os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1"),
        )

    @property
    def gen_ai_system(self) -> str:
        return "openai"

    @property
    def model(self) -> str:
        return self._model

    async def chat(self, messages: List[LLMMessage]) -> LLMResponse:
        oai_messages = [{"role": m.role, "content": m.content} for m in messages]
        response = await self._client.chat.completions.create(
            model=self._model,
            messages=oai_messages,
        )
        choice = response.choices[0]
        usage = response.usage
        return LLMResponse(
            content=choice.message.content or "",
            model=response.model,
            input_tokens=usage.prompt_tokens if usage else 0,
            output_tokens=usage.completion_tokens if usage else 0,
            gen_ai_system="openai",
            finish_reason=choice.finish_reason or "stop",
        )
