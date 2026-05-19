# Diagnostics

Folder for Cowork-produced diagnostic reports. See
`project_instructions.md` §19 for the full rules.

## Folder convention

Each diagnostic gets its own subfolder named
`YYYY-MM-DD-<topic>/`. The report itself is always called
`REPORT.md` inside that folder. Topic is a short kebab-case
slug (e.g. `b01-blank-page`, `b08-win-count-race`,
`scheduler-weekend-rendering`).

```
docs/diagnostics/
├── README.md              (this file)
├── 2026-05-18-b01-blank-page/
│   └── REPORT.md
└── 2026-05-19-something-else/
    └── REPORT.md
```

Supporting artefacts (screenshots, HAR exports, large DB
dumps) can live alongside REPORT.md in the same subfolder.

## When to commit

Default: diagnostic reports are NOT committed. They are
working artefacts produced during investigation. Cowork
generates them; Marco reviews them; MAIN reads them; Claude
Code (or merge action) operates based on them. The resulting
fix PR (or merge decision) is the durable record.

Commit a report only in one of these cases:

**Case 1 — Lessons-learned record.** The diagnostic surfaces
a class of bug worth future reference. Example: the B01.1
precedence-bug investigation (`2026-05-18-b01-blank-page/REPORT.md`)
is committed because it documents a TypeScript optional-chaining
trap that could recur, and the evidence chain (source analysis
→ symptom shape → runtime trace) is a methodology future
maintainers can apply.

**Case 2 — Triage template.** The report establishes a pattern
for recurring future investigations. Example: the Dependabot
PR #207 triage (`2026-05-19-dependabot-207/REPORT.md`) is
committed because it's the first Cowork-assisted dependency
review and serves as the template for future Dependabot bumps
— especially the lockfile-diff-vs-PR-title check that caught
a misleading title in #207.

**Case 3 — Architectural decision evidence.** The diagnostic
captures evidence that shaped a Design Map entry or future-PR
decision. Example: the service-worker behaviour observed
during B01.1's deployment informed `P-platform3` in the
Design Map; if a future investigation produces evidence at
that level of impact, commit it.

For cases that don't fit any of the above, leave the report
uncommitted. Marco can always move a committed report to
`docs/lessons-learned/` later if it grows into a more formal
reference. The default uncommitted state is captured in
`project_instructions.md` §19 and remains the canonical rule
— this README is the operational override.

## Report template

Every REPORT.md should follow this skeleton:

````markdown
# Diagnostic: <topic>

**Date:** YYYY-MM-DD
**Triggered by:** brief description of what MAIN asked for
**Investigator:** Cowork

## §1 — <first thing asked for>

<verbatim file paste, code, or command output>

## §2 — <second thing>

<verbatim ...>

## §3 — <third thing>

<verbatim ...>

## Summary
(Optional — keep to factual bullet list, no interpretation.
Interpretation is MAIN's job from the verbatim sections above.)
````

## What goes in a section

- **Verbatim**. Paste the file content / command output exactly.
  Do not summarise.
- **Line numbers** if relevant (e.g. `apps/web/src/foo.ts:42-67`).
- **Commands** that produced any output, so MAIN can reproduce.
- **No interpretation, no recommendations**. Those are MAIN's
  output, not Cowork's.

## Example report request from MAIN

See `docs/diagnostics/2026-05-18-b01-blank-page/REPORT.md` (if
committed) for the first example produced under these rules.
