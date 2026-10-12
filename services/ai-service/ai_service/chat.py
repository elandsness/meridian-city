"""
ChatService — core chatbot orchestration.

Responsibilities:
  1. Maintain per-session conversation history (in-memory, capped at MAX_HISTORY_TURNS)
  2. Resolve industry-specific system prompts dynamically at runtime
  3. Optionally enrich context from identity/customer services
  4. Apply fault injection (LLM latency)
  5. Call the LLM provider (OpenLLMetry auto-instruments it)
  6. Attach session.id correlation to the trace
  7. Emit a structured Business Event log (chatbot.interaction) for Dynatrace Business Analytics

GenAI spans (gen_ai.request.model, gen_ai.usage.*, gen_ai.response.finish_reason,
…) are produced automatically by the Traceloop OpenLLMetry instrumentation of the
OpenAI/Anthropic clients — see otel.py. This module only adds a thin parent span
carrying session.id and sets it as a Traceloop association property so the
auto-spans inherit it.
"""
from __future__ import annotations

import logging
import os
import re
from collections import defaultdict
from typing import Dict, List, Optional

import httpx
from opentelemetry.trace import StatusCode

from .fault import fault_state
from .llm.base import LLMMessage, LLMProvider, LLMResponse
from .otel import get_tracer

logger = logging.getLogger(__name__)
biz_logger = logging.getLogger("BusinessEvents")

# Maximum number of turns (user+assistant pairs) to retain per session.
MAX_HISTORY_TURNS = 10

# Generic fallback for when no runtime config is available.
def _get_generic_fallback_prompt(name: str, company: str, phone: str) -> str:
    return f"""You are {name}, the official virtual assistant for {company}. 
Be professional, concise, and helpful. If a user needs to reach a person, 
give the support line: {phone}, or direct them to the official portal."""

# Regex to extract a service request ID embedded in the user's message (e.g., "req-00123").
_REQUEST_ID_RE = re.compile(r"\breq[-_]?(\d+)\b", re.IGNORECASE)


def _associate_session(session_id: str) -> None:
    """
    Tag the current trace with the session id via Traceloop so the auto-emitted
    gen_ai.* span inherits it. Dev-safe: a no-op when OpenLLMetry isn't installed.
    """
    try:
        from traceloop.sdk import Traceloop
        Traceloop.set_association_properties({"session_id": session_id})
    except Exception:
        pass


class ChatService:
    def __init__(self, provider: LLMProvider) -> None:
        self._provider = provider
        # Semantically renamed from _citizen_url
        self._customer_url = os.getenv("CUSTOMER_SERVICE_URL", "http://identity-service:8081")
        self._ops_url = os.getenv("OPS_SERVICE_URL", "http://ops-engine:8083")
        # New: URL to the industry persona config (e.g., demo-control-api or a config-service)
        self._config_url = os.getenv("INDUSTRY_CONFIG_URL")
        
        self._http = httpx.AsyncClient(timeout=5.0)
        # session_id → list of LLMMessage (excludes the system prompt)
        self._sessions: Dict[str, List[LLMMessage]] = defaultdict(list)

    async def close(self) -> None:
        await self._http.aclose()

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    async def chat(
        self,
        message: str,
        session_id: str,
        request_id: Optional[str] = None,
    ) -> LLMResponse:
        """
        Process a customer chat message and return an LLM response.
        Stores conversation history for multi-turn context.
        """
        tracer = get_tracer()

        # Enrich context: explicit request_id arg takes priority over one
        # extracted from the message body.
        if not request_id:
            m = _REQUEST_ID_RE.search(message)
            if m:
                request_id = f"req-{m.group(1).zfill(5)}"

        context = await self._fetch_context(request_id)
        
        # Resolve prompt dynamically for this specific request (Runtime Persona)
        system_prompt = await self._resolve_system_prompt()
        
        # Build full message list: system prompt + history + new user turn
        history = self._sessions[session_id]
        messages = self._build_messages(message, context, history, system_prompt)

        # Associate the session id with every span in this trace
        _associate_session(session_id)

        with tracer.start_as_current_span("meridian.chat") as span:
            span.set_attribute("session.id", session_id)
            if request_id:
                span.set_attribute("request.id", request_id)

            # Fault injection — artificial LLM latency
            await fault_state.maybe_delay()

            try:
                response = await self._provider.chat(messages)
            except Exception as exc:
                span.set_status(StatusCode.ERROR, str(exc))
                span.record_exception(exc)
                logger.error(
                    "llm.chat.failed",
                    extra={"error": str(exc), "session.id": session_id},
                )
                raise

            span.set_status(StatusCode.OK)

        # Update session history
        history.append(LLMMessage(role="user", content=message))
        history.append(LLMMessage(role="assistant", content=response.content))
        self._trim_history(session_id)

        # Structured log for Dynatrace Business Analytics
        biz_logger.info(
            "chatbot.interaction",
            extra={
                "event.type": "chatbot.interaction",
                "session.id": session_id,
                "gen_ai.system": response.gen_ai_system,
                "gen_ai.request.model": self._provider.model,
                "gen_ai.response.model": response.model,
                "gen_ai.usage.input_tokens": response.input_tokens,
                "gen_ai.usage.output_tokens": response.output_tokens,
                "has_context": bool(context),
            },
        )

        logger.info(
            "llm.chat.completed",
            extra={
                "gen_ai.system": response.gen_ai_system,
                "gen_ai.response.model": response.model,
                "gen_ai.usage.input_tokens": response.input_tokens,
                "gen_ai.usage.output_tokens": response.output_tokens,
                "session.id": session_id,
            },
        )

        return response

    def get_history(self, session_id: str) -> List[dict]:
        """Return the conversation history for a session as a list of dicts."""
        return [
            {"role": m.role, "content": m.content}
            for m in self._sessions.get(session_id, [])
        ]

    def clear_session(self, session_id: str) -> None:
        """Delete the conversation history for a session."""
        self._sessions.pop(session_id, None)

    def active_session_count(self) -> int:
        return len(self._sessions)

    # ------------------------------------------------------------------
    # Internals
    # ------------------------------------------------------------------

    async def _resolve_system_prompt(self) -> str:
        """
        Dynamic Persona Resolution.
        Fetch the system prompt from the configured runtime endpoint.
        Falls back to generic parameters if fetch fails or is not configured.
        """
        name = os.getenv("ASSISTANT_NAME", "Assistant")
        company = os.getenv("COMPANY_NAME", "Meridian")
        phone = os.getenv("SUPPORT_PHONE", "1-555-GENERIC")

        if self._config_url:
            try:
                # Endpoint expected to return { "systemPrompt": "..." }
                resp = await self._http.get(f"{self._config_url}/persona")
                if resp.status_code == 200:
                    return resp.json().get("systemPrompt", _get_generic_fallback_prompt(name, company, phone))
            except Exception as exc:
                logger.debug("runtime persona fetch failed: %s", exc)
        
        return _get_generic_fallback_prompt(name, company, phone)

    def _build_messages(
        self,
        user_message: str,
        context: str,
        history: List[LLMMessage],
        system_prompt: str,
    ) -> List[LLMMessage]:
        system = system_prompt
        if context:
            system += f"\n\n---\nEntity Context:\n{context}"

        messages: List[LLMMessage] = [LLMMessage(role="system", content=system)]
        messages.extend(history)
        messages.append(LLMMessage(role="user", content=user_message))
        return messages

    def _trim_history(self, session_id: str) -> None:
        """Keep only the last MAX_HISTORY_TURNS turn pairs."""
        history = self._sessions[session_id]
        max_messages = MAX_HISTORY_TURNS * 2
        if len(history) > max_messages:
            self._sessions[session_id] = history[-max_messages:]

    async def _fetch_context(self, request_id: Optional[str]) -> str:
        """
        Fetch entity context from the customer service for chatbot context.
        Returns an empty string if unavailable — never blocks the chat flow.
        """
        if not request_id:
            return ""

        try:
            resp = await self._http.get(
                f"{self._customer_url}/api/v1/requests/{request_id}"
            )
            if resp.status_code == 200:
                data = resp.json()
                return (
                    f"Request ID: {request_id}\n"
                    f"  Category: {data.get('category', 'unknown')}\n"
                    f"  Status: {data.get('status', 'unknown')}\n"
                    f"  Description: {data.get('description', '')}\n"
                    f"  Submitted: {data.get('submittedAt', '')}\n"
                    f"  Last updated: {data.get('updatedAt', '')}"
                )
        except Exception as exc:
            logger.debug("context fetch failed for %s: %s", request_id, exc)

        return ""
