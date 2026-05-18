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

Default: diagnostic reports are NOT committed. They are working
artefacts produced during investigation. Cowork generates them;
Marco reviews them; MAIN reads them; Claude Code ships a fix
based on them. The fix's PR is the durable record.

Commit a report only if:
- It surfaces a recurring class of bug worth referencing later
  (in which case, consider moving the content to
  `docs/lessons-learned/`)
- It documents a "we investigated and decided not to fix"
  decision worth preserving

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
