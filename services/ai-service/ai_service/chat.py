"""
ChatService — core chatbot orchestration.

Responsibilities:
  1. Maintain per-session conversation history (in-memory, capped at MAX_HISTORY_TURNS)
  2. Build a Meridian City Assistant system prompt
  3. Optionally enrich context from citizen-service / city-operations
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

# Assistant persona is config-driven (Phase 1). The industry config supplies the
# assistant name + company (and, optionally, a full ASSISTANT_SYSTEM_PROMPT override
# and SUPPORT_PHONE for non-city industries). Defaults reproduce the Meridian City
# persona exactly.
ASSISTANT_NAME = os.getenv("ASSISTANT_NAME", "Meri")
COMPANY_NAME = os.getenv("COMPANY_NAME", "Meridian City")
SUPPORT_PHONE = os.getenv("SUPPORT_PHONE", "1-555-MERIDIAN (1-555-637-4326)")


def _default_system_prompt(name: str, company: str, phone: str) -> str:
    return f"""\
You are {name}, the official virtual assistant for {company} — a real,
mid-sized city. Always respond as though {company} genuinely exists and you
are its assistant. Never say you are a generic AI model or that the city is
fictional, and never break character.

You help residents with:
- Reporting city issues (potholes, broken streetlights, water main breaks, graffiti)
  — remind residents they can file a service request in the {company} Portal.
- Checking the status of a submitted service request (by request ID, e.g. req-00123).
- Current incidents and city service information (parks, libraries, transit, permits).
- Paying city tax bills and shopping the {company} store — both in the portal.

If a resident needs to reach a person, give the {company} services line:
{phone}, available Mon–Fri 8 am – 6 pm, or direct them to
submit a service request in the portal.

Be concise, warm, and professional. Acknowledge the resident's concern before
providing information. If a service request ID is mentioned, use the context below
to give a specific update.\
"""


# Full override wins; otherwise build the default from the brand env vars.
_SYSTEM_PROMPT = os.getenv("ASSISTANT_SYSTEM_PROMPT") or _default_system_prompt(
    ASSISTANT_NAME, COMPANY_NAME, SUPPORT_PHONE
)

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
        self._citizen_url = os.getenv("CITIZEN_SERVICE_URL", "http://citizen-service:8081")
        self._city_ops_url = os.getenv("CITY_OPERATIONS_URL", "http://city-operations:8083")
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
        Process a citizen chat message and return an LLM response.
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

        # Build full message list: system prompt + history + new user turn
        history = self._sessions[session_id]
        messages = self._build_messages(message, context, history)

        # Associate the session id with every span in this trace, including the
        # gen_ai.* span OpenLLMetry emits for the provider call below.
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

    def _build_messages(
        self,
        user_message: str,
        context: str,
        history: List[LLMMessage],
    ) -> List[LLMMessage]:
        system = _SYSTEM_PROMPT
        if context:
            system += f"\n\n---\nService Request Context:\n{context}"

        messages: List[LLMMessage] = [LLMMessage(role="system", content=system)]
        messages.extend(history)
        messages.append(LLMMessage(role="user", content=user_message))
        return messages

    def _trim_history(self, session_id: str) -> None:
        """Keep only the last MAX_HISTORY_TURNS turn pairs."""
        history = self._sessions[session_id]
        max_messages = MAX_HISTORY_TURNS * 2  # each turn = user + assistant
        if len(history) > max_messages:
            self._sessions[session_id] = history[-max_messages:]

    async def _fetch_context(self, request_id: Optional[str]) -> str:
        """
        Fetch a service request from citizen-service for chatbot context.
        Returns an empty string if unavailable — never blocks the chat flow.
        """
        if not request_id:
            return ""

        try:
            resp = await self._http.get(
                f"{self._citizen_url}/api/v1/requests/{request_id}"
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
