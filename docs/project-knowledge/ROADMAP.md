# Roadmap — proposed order, not approval to execute
## P0: reconcile and adopt
1. Review this documentation PR; compare recovered Work artifacts with main and #41. Preserve branch #41; do not merge blindly. Verify exact refs/checks and current staging configuration.
2. On #41, build a feature-to-test traceability matrix for onboarding, inbox, CRM, agents/templates, flow drag/drop, calendar, campaigns/images, settings/teams/fields, quick replies, hours, notifications, Meta template sync and cost visibility. Re-run acceptance, PostgreSQL, browser tests and isolated migration/restore; resolve regressions. Validate responsive layout and loading.
3. Obtain owner review of UI and scope; if commercial features disabled, keep disabled; separate release approval. 
## P1: operating gates before pilot
- Meta eligible sandbox/test account: complete official signup, actual incoming/outgoing, status and template sync, token renewal/disconnect; all scopes reviewed. Enable no unapproved channel.
- Validate economical OpenAI model availability and cost: benchmark realistic Arabic/English customer inquiries, RAG accuracy, hallucination, prompt injection, handoff, tool approvals, latency and token budget; set policy/quotas per tenant. Live testing only with permission.
- Verify permanent SMTP, scanning, worker schedule, alert delivery, actual R2 restore, retention/deletion ledger, cost under representative traffic, queue age and Vercel CPU. Confirm isolated staging and production boundaries.
- Resolve legal entity/DPA, PDPL transfer, taxes and commercial approval; no real billing until authorized.
## P2: scale and experience
Use representative workload and tenant isolation regression to prioritize pagination, indexes, caching, queue throughput and realtime efficiency; budget alerts; observability; advanced CRM/campaign and workflows only after focused scope signoff. Marketing cinematic transformation to be separately reconciled with accepted identity and performance. No unnecessary infrastructure rewrite.
## Definition of done
Code, tests, exact commit, reproducible evidence, documented exceptions and approval. Track owner decisions distinctly from proposals; keep knowledge base current.
