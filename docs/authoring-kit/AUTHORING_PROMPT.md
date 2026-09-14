


### ⚠️ THE DYNATRACE EVENT CONTRACT
To prevent "Isolated Events" and broken KPIs in Dynatrace, you MUST follow these strict naming rules:
1. **Correlation ID:** Always use `{entity_type}.id` (e.g., `service_request.id`). Never use generic names like `req_id` or `id`.
2. **Event Names:** Every event MUST follow the pattern `{entity_type}.{state}` (e.g., `service_request.submitted`).
3. **No Invention:** Do not invent descriptive event names. Use ONLY the `state` IDs defined in the `entities` block of the industry YAML.
4. **One Entity per Flow:** A Business Flow can only track one correlation ID. If a process moves from one entity (e.g., Incident) to another (e.g., Work Order), you must define them as two separate flows.
