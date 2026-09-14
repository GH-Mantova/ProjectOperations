# CRM Module Mock-up — artboard snapshot for the vision review

Source of record: the published artifact **CRM Module Mock-up**
`https://claude.ai/code/artifact/3372e3ff-b041-47cd-a47e-d5897f06a62c` (id `3372e3ff`).
That URL is the `design_ref` every CRM prompt cites; this folder is a **snapshot of its nine
artboards**, exported 2026-09-14 from the artifact's own `appifact-doc` block so that CI, the
watcher and a headless builder — none of which can open claude.ai — can render the same
1440x900 boards the vision review compares a screen against.

- `canvas.json` — artboard list with sizes and titles, plus the four canvas annotations.
- `*.dc.html` — one artboard each: Nav, Accounts List (Main), Relationships, Account 360,
  Register, Follow-ups, Bulk-link preview, Comms Inbox (Intake), Comms Threads.

Rendered by `scripts/pipeline/render-artboards.mjs` (crmvis S0). Proposal: `../crm-visual-parity.md`.

Reading an artboard: an **orange dot** marks something that did not exist when the mock-up was drawn and the **amber strip** at the foot of a screen is the designer's note on what changes and why. Both are annotations, not UI — neither is built and the vision review ignores them.

**Rules.** The artifact stays the design of record; this is tooling input. If the artifact is
republished, re-export here in the same change and say so in the PR. Never edit these files by
hand. Contains the mock-up's fixture names (staff initials, client names, public ABNs) — the
repository is private and the register already marks the artifact internal-only; do not copy
these files anywhere public.
