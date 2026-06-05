# ai-service

**Language**: Python 3.12 / FastAPI  
**Port**: 8085  
**Status**: Phase 4 — not yet implemented

## Role

Citizen chatbot ("Ask the City Assistant") backed by a configurable LLM. Uses the OTel SDK with GenAI semantic conventions for Dynatrace AI Observability.

## LLM backend

Configurable via `LLM_PROVIDER` environment variable:

| Provider | Env var value | Requires |
|---|---|---|
| OpenAI GPT-4o | `openai` | `OPENAI_API_KEY` |
| Anthropic Claude | `anthropic` | `ANTHROPIC_API_KEY` |
| Local Ollama | `local` | `LOCAL_LLM_ENDPOINT` (e.g., `http://ollama:11434`) |

## OTel instrumentation

Uses the OpenTelemetry Python SDK with GenAI semantic conventions. Each LLM call creates a span with:

| Attribute | Example value |
|---|---|
| `gen_ai.system` | `openai` |
| `gen_ai.request.model` | `gpt-4o` |
| `gen_ai.usage.prompt_tokens` | `342` |
| `gen_ai.usage.completion_tokens` | `156` |
| `gen_ai.response.finish_reason` | `stop` |

Spans flow through the OTel Collector → Dynatrace AI Observability.

## Chatbot capabilities

- Answer questions about city services (uses static knowledge base)
- Look up service request status (calls citizen-service)
- Report current incidents (calls city-operations)
- Route complex requests to appropriate department

## Fault injection

`FAULT_LLM_LATENCY_ENABLED=true` + `FAULT_LLM_LATENCY_SECONDS=10` injects artificial delay before the LLM call.

## Key endpoints

- `POST /api/v1/chat` — citizen chat message → LLM response
- `GET /api/v1/chat/history/{session_id}` — conversation history
- `POST /admin/fault` — runtime fault injection
- `GET /health`

## Build

```bash
pip install -r requirements.txt
uvicorn main:app --reload
```
