# Requirements and acceptance map
Baseline requirements from original blueprint, AI agent brief, recent product instructions and repository docs. Required is not equivalent to delivered.
| Area | Required behavior | Current evidence / work |
|---|---|---|
| Marketing | independent Arabic/English identity, product story, responsive hero, motion, accurate solutions and conversion routes | main brand assets; cinematic marketing brief not fully audited |
| SaaS | isolated companies, secure accounts, roles, plan selection, quotas, billing and provider controls | V2 documented tested; payment and public activation gated |
| Channels | official Meta signup, status, scopes, templates/media, receive/send, delivery, renew/disconnect | connectors on main, live approval pending; focused onboarding on #41 |
| Inbox | shared workspace, assignment, notes, saved filters, unread, search, history, statuses, pagination, handover, quick replies | main core; improved filtering/width and controls in #41, verify UI |
| CRM | contacts, identity linking, timeline, labels, stages, segments, CSV import, custom fields, teams, tasks/calendar, permissions | main core; #41 adds focused CRM/calendar/control code, verify each behavior |
| Agents | draft/version/publish, instructions/playbook, variables, language, tone, routing, modes, test sandbox, inspector, templates | main Agent Studio docs and modules; compare requested full set with implementation; #41 templates |
| Knowledge | Q&A, TXT/DOCX/PDF, websites, review/approval/version, sync, tenant-safe retrieval, fallback and citations | main knowledge/retrieval code; live model, source accuracy and malicious-input tests pending |
| Actions | internal task/tag/assignment, configured external actions, least privilege, human approval, idempotency, audit, timeouts | main agent actions; external sandbox and live gated |
| AI runtime | economical routing, customer response, no inventing facts, copilot, escalation, pause/resume, tool safeguards | main agent engine and quotas; live OpenAI and quality benchmark missing |
| Automation | triggers, conditions, actions, drag/drop builder, templates, simulation, scheduling, human handoff, execution log | #41 flow runtime/UI; not production |
| Campaigns | template library, sync, images, opt-in, scheduling, policy checks and cost visibility | #41 contains image/template/control code; full campaign behavior not verified |
| Settings | channel controls, organized sections, teams, fields, working hours, quick replies, notifications, app icon/navigation | latest owner scope; #41 related code, individual verification pending |
| Analytics | response times, outcomes, AI usage, model/token spend, Meta fee separation, reports | documented core; validate metrics and real invoices; no paid billing approval |
| Security/ops | tenant isolation, RBAC, sessions, rate limits, webhook verification, secret protection, retention, export/delete, backup, incident handling | controls exist, live compliance/scale verification remains |
## Nonfunctional acceptance
Arabic RTL/English LTR; mobile/tablet/desktop; WCAG-oriented contrast/focus/keyboard; reduced-motion; no layout flash; efficient polling/realtime behavior and no excessive CPU; durable retries/dedup and no loss; privacy and data minimization; schema migrations compatible with rollback; synthetic tests and isolated staging before release. Measure latency, queue age, p95 and costs with representative workload; no SLA invented. Preserve owner intent to prefer affordable OpenAI models over premium reasoning for ordinary replies; require actual model ID, quality and cost validation.
## Boundaries
TikTok and Snapchat (official eligible APIs only), store/ERP/Zoho, deeper ads, advanced campaign sequences and independent site chat/email channels are backlog unless a later explicit scope overrides. Never claim supported merely from a marketing tile.
