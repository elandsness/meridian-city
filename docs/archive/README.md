# Archive — historical engineering records

These documents are **not current reference material**. They're the planning,
audit, and incident-response artifacts produced while building the platform —
kept for history, not for operating the platform today. If you're looking for
how the platform works *now*, start at the [main README](../../README.md) and
[docs/architecture.md](../architecture.md) instead.

Several of these predate the "semantic engine" rewrite and use service names
that no longer exist (`citizen-service`, `service-dispatch`, `city-operations`,
`commerce-service`, `billing-service`). See the README's
[breaking-change notice](../../README.md#-breaking-change--read-before-touching-an-existing-deployment-or-config)
if that's what brought you here.

| Doc | What it is |
|---|---|
| [PLAN.md](PLAN.md) | Build tracker for the original fixed "Meridian City" app, pre-rewrite |
| [REQUIREMENTS.md](REQUIREMENTS.md) | Product requirements for the original fixed "Meridian City" app |
| [INDUSTRY_PLATFORM_PLAN.md](INDUSTRY_PLATFORM_PLAN.md) | The original design plan for turning Meridian into a multi-industry platform (airport flagship). Its own checkboxes were never marked done even though the work shipped — the services it proposed (`flight-ops`, `airfield-sim`) shipped under more generic names (`journey-service`, `movement-service`) |
| [Generic-Entity-Engine-Audit-Report.md](Generic-Entity-Engine-Audit-Report.md) | Audit that specified the generic entity engine rewrite |
| [2026-08-27-generic-entity-engine-reskinning-plan.md](2026-08-27-generic-entity-engine-reskinning-plan.md) | Execution plan implementing the audit report above |
| [MODERNIZATION_TRACKER.md](MODERNIZATION_TRACKER.md) | Gap-tracking checklist from mid-migration to the generic platform |
| [regression-baseline-2026-07-23.md](regression-baseline-2026-07-23.md) | A point-in-time "what does `main` do right now" snapshot, captured as a diff oracle for the generic-entity-engine migration |
| [DEMO_CONTROL_VALIDATION.md](DEMO_CONTROL_VALIDATION.md) | A dated, live-cluster validation pass over Demo Control fault scenarios |
| [the_fix.md](the_fix.md) / [the_fix_alternatives.md](the_fix_alternatives.md) | Incident notes for one specific EBS CSI driver / IAM issue on EKS |

If something here turns out to still be true and useful day-to-day, the fix is
to move the relevant fact into a current doc (README, `architecture.md`,
`setup-guide.md`, `authoring-kit/`) — not to treat this folder as up to date.
