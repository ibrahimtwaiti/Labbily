# Decision record
Status: owner decisions summarized from available instructions and historical repository records; not authority to take actions outside current task.
| Decision | State |
|---|---|
| Wasla renamed Labbily; GitHub and Vercel use Labbily | approved Nov 24; merge #38 observed |
| Preserve existing systems; shared tenant-aware SaaS, Saudi B2B, SAR, Arabic/English | historical approved direction; V1 governance |
| Neon PostgreSQL, Vercel, private R2 | approved architecture history; verify live settings separately |
| Provider administration owns integration/model/account setup and toggles | explicit owner requirement; no hardcoding |
| Separate admin entry from marketing navigation | owner requirement; verify route/auth implementation, hidden URL is not a security boundary |
| Brand palette and IBM Plex Sans Arabic/Inter; independent design, premium 3D/motion | approved identity; source tokens in repo |
| Flovoo main reference; Respond.io and Wats complementary | recent owner direction; focused notes document weighting |
| Prefer affordable OpenAI models for customer replies, not premium research models | explicit product direction; model selection remains unapproved until benchmark and actual API availability/prices validated |
| V1 owner accepted A–H; no MFA requirement in V1 | historical risk exception only, not permanent or provider/legal exemption |
| Backup without separate age in V1; later V2 staging encrypted restore reported | conflict by scope, not a blanket security decision; confirm latest policy before changing |
| Owner alone handles operational alerts in V1 | historical; do not publish personal contact or assume backup staffing |
| Previously exposed credentials | historical exception does not render them safe; rotate before sensitive use, do not reproduce or log |
| Current handover: docs branch and review PR only; no functional changes, production DB writes, identity changes, merge/deploy | explicit current instruction |
References: [V1 governance](../V1_OWNER_GOVERNANCE_AR.md), [V1 closeout](../V1_CLOSEOUT_AR.md), [R2 restore](../BACKUP_RESTORE_AR.md), [production readiness](../../LABBILY_PRODUCTION_READINESS.md).
