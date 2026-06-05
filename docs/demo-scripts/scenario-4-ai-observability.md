# Demo Scenario 4: LLM / AI Observability

**Duration**: ~5 minutes  
**Dynatrace features**: AI Observability, GenAI spans, token usage, model latency  
**Narrative**: "The chatbot is handling citizen requests. Dynatrace sees every LLM call — latency, tokens, and cost."

---

## Setup

- Public Portal open: http://localhost:8080
- Dynatrace open on **AI Observability** (left nav)
- Have 3-4 chatbot questions ready (see below)

---

## Scripted chatbot questions

Use these questions for a natural-looking demo flow:

1. "What services does the city of Meridian offer?"
2. "How do I report a pothole on my street?"
3. "What's the status of service request req-00003?"
4. "Is there currently an outage affecting the North District?"

---

## Script

### 1. Introduce the chatbot (30 sec)

In the Public Portal, scroll to the chatbot widget in the bottom right:
> "Meridian has an AI-powered City Assistant that citizens can use to get information and report issues. It's backed by an LLM — in this case, GPT-4o — and it has context about the city's services, current incidents, and can look up citizen request status."

### 2. Make chatbot requests (2 min)

Ask the 4 scripted questions above, one at a time. Show the responses — they should be natural and city-specific.

> "Looks great from the citizen's perspective. But what's happening behind the scenes?"

### 3. Open AI Observability in Dynatrace (2 min)

Navigate to Dynatrace → AI Observability:

> "Here's where Dynatrace's AI Observability comes in. Every single LLM call made by our chatbot is captured as an OpenTelemetry trace with standardized GenAI semantic convention attributes."

Point out:
- **Model**: `gpt-4o` (or whichever provider is configured)
- **Request latency**: P95 response time per LLM call
- **Token usage**: prompt tokens and completion tokens per request
- **Cost estimate**: derived from token usage and model pricing

Click on one of the individual LLM call spans:
> "Drilling into a single call — I can see exactly what was sent to the model, how many tokens the prompt consumed, how many were in the response, and how long the model took to respond. This is the level of visibility you need when you're deploying LLMs at enterprise scale."

### 4. Show the trace waterfall (1 min)

Find a trace that includes the chatbot flow:
- `api-gateway` → `ai-service` → LLM API (external span) → response

> "Notice this is a standard distributed trace — the LLM call is just one span in the full citizen request journey. We can see exactly how much of the total request time was spent in the LLM versus in our own services."

### 5. Optional: Inject LLM latency (bonus)

In Demo Control Panel: **"Simulate LLM Latency Spike"** (injects 10s delay)

Submit another chatbot message — it hangs.

In Dynatrace, watch the LLM span latency spike. If Davis AI detects it (may take a minute):
> "Davis AI is now flagging the AI service as degraded. The root cause points directly to the LLM response time — not our services, but the model itself."

Reset: **"Clear all failures"**

---

## Key talking points

- Dynatrace AI Observability works via standard OTel GenAI semantic conventions — no proprietary SDK
- Every LLM call is traced with model, tokens, latency, and cost attribution
- LLM calls appear in the same distributed trace as the rest of the application
- Supports any LLM provider: OpenAI, Anthropic, local models via Ollama
- Critical for enterprise AI governance: cost control, performance SLOs, anomaly detection
