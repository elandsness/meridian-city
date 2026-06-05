"""
Local (Ollama) LLM provider.

Uses Ollama's OpenAI-compatible endpoint (/v1/chat/completions), so we can
reuse the openai client with a custom base_url and a dummy API key.

Reads:
  LLM_MODEL          — model name (default: llama3)
  LOCAL_LLM_ENDPOINT — base URL of the Ollama instance (default: http://ollama:11434)
"""
from __future__ import annotations

import os
from typing import List

from openai import AsyncOpenAI

from .base import LLMMessage, LLMProvider, LLMResponse


class LocalProvider(LLMProvider):
    def __init__(self) -> None:
        self._model = os.getenv("LLM_MODEL", "llama3")
        endpoint = os.getenv("LOCAL_LLM_ENDPOINT", "http://ollama:11434")
        self._client = AsyncOpenAI(
            api_key="ollama",          # Ollama ignores the key but AsyncOpenAI requires a non-empty value
            base_url=f"{endpoint}/v1",
        )

    @property
    def gen_ai_system(self) -> str:
        return "ollama"

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
            model=response.model or self._model,
            input_tokens=usage.prompt_tokens if usage else 0,
            output_tokens=usage.completion_tokens if usage else 0,
            gen_ai_system="ollama",
            finish_reason=choice.finish_reason or "stop",
        )
