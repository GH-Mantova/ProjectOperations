# crm-visual-parity — the shipped CRM screens look like the CRM Module Mock-up

**Surface.** `/crm/accounts` (List, Relationships), `/crm/accounts/:id`, `/crm/register`
(Register, Follow-ups), the Review-and-link preview, `/crm/comms` (Inbox, Threads, To-dos).

**Change.** Content parity with the mock-up shipped on 2026-09-05 (`crmui-*`, #1609–#1637) but
visual parity was never checked: the eight pages are built from inline `style={{}}` objects
carrying ~400 hex literals (indigo `#6366f1` / `#4f46e5` buttons and chips, tab cards above the
page title, native selects) and use `tokens.css` almost nowhere, while `tokens.css` already
carries the mock-up's palette (`--brand-primary #005B61`, `--brand-accent #FEAA6D`, page
`#F6F6F6`, black sidebar). The `crmvis` cluster moves each screen onto the `s7-*` kit + tokens,
one screen per slice, with a side-by-side PNG (app | artboard) as the acceptance evidence.

**References.** Design of record: the published artifact **CRM Module Mock-up**
`https://claude.ai/code/artifact/3372e3ff-b041-47cd-a47e-d5897f06a62c`. The nine artboards are
snapshotted beside this file in `crm-visual-parity/` so CI and a headless builder can render them
(`scripts/pipeline/render-artboards.mjs`, crmvis S0). Prompts: `docs/pr-prompts/pr-crmvis-s0…s8`.
