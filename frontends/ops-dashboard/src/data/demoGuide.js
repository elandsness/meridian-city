// Inline demo guide shown in the Demo Control page (OPS-6). Concise operator-facing
// summaries of the five scenarios documented in docs/demo-scripts/*.md — so the
// presenter knows what each shows and how to run it without leaving the dashboard.
export const DEMO_GUIDE = [
  {
    id: 1,
    title: 'Distributed trace',
    shows: 'End-to-end PurePath across the service chain.',
    steps: [
      'Start traffic, or submit a service request in the public portal.',
      'Dynatrace → Distributed traces: open a request hitting ops-entity-service.',
      'Walk the waterfall: api-gateway → customer-entity-service → routing-service → ops-entity-service, with SQL + Kafka spans.',
    ],
  },
  {
    id: 2,
    title: 'Davis AI root cause',
    shows: 'Davis detects an injected fault and pinpoints the root cause.',
    steps: [
      'Activate a scenario below (e.g. Database Slowdown).',
      'Run a traffic burst to amplify load.',
      'Dynatrace → Problems: watch Davis raise a problem and identify the slow service.',
      'Disable the fault to recover.',
    ],
  },
  {
    id: 3,
    title: 'IoT alert',
    shows: 'IoT device telemetry (OTel metrics/logs) with Davis AI detecting the anomaly directly — no custom detection code.',
    steps: [
      'Enable an ongoing fault gate on a device type below (e.g. vehicle engine_temp +35%).',
      'Watch the metric spike in Dynatrace and Davis AI raise a problem from the raw telemetry.',
      'Disable the fault gate to recover.',
    ],
  },
  {
    id: 4,
    title: 'AI observability',
    shows: 'OpenLLMetry gen_ai spans + token usage for the chatbot.',
    steps: [
      'Chat with Meri in the portal (or enable the chatbot traffic journey).',
      'Dynatrace → AI Observability: show model, token usage, and latency.',
      'Optionally activate the LLM Latency Spike scenario below to demo a degradation.',
    ],
  },
  {
    id: 5,
    title: 'Business events & funnels',
    shows: 'Business processes as funnels (requests, purchase, tax).',
    steps: [
      'Run traffic so citizens submit requests, buy merch, and pay taxes.',
      'Dynatrace → Business Analytics: open the Service Request, Purchase, and Tax Payment funnels.',
      'Show conversion + drop-off; correlate a RUM session to its funnel on the shared key.',
    ],
  },
]
