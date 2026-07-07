# Weekly Source-of-Truth Sweep

A scheduled agent runs **00:00 Monday (Australia/Brisbane)** and performs a
**read-only** audit that the source-of-truth documents still match reality. It
never edits code, schema, or the owned docs — it produces a findings report and
surfaces it to Marco. Fixing anything it finds is a deliberate, separate action.

<!-- TOC:START -->
- [What it checks](#what-it-checks)
- [How it reports](#how-it-reports)
- [What it must never do](#what-it-must-never-do)
<!-- TOC:END -->

## What it checks

1. **Schema ↔ map drift** — `build-relationship-map.mjs --check`. Fails if the
   committed relationship map is stale versus `schema.prisma`.
2. **Model ↔ migration ↔ code coherence** — every `model` in the schema has a
   backing migration; every migration-created table has a live model; every
   `apps/api/src` module that references a model resolves to one that exists.
   (This is the check that catches drift like a `pilot_feedback` migration +
   module with no `model PilotFeedback` in the schema.)
3. **TOC freshness** — `build-toc.mjs --check` across every document in the
   source-of-truth registry.
4. **Catalog coverage** — models in `wizardVisible` domains that are missing from
   `metadata-catalog.json` or still `"reviewed": false`.
5. **Registry ↔ reality** — models/modules that exist in the repo but are not
   reflected in `project_instructions.md`'s module registry, and vice-versa.

## How it reports

- Writes a timestamped report to `docs/data-model/sweeps/YYYY-MM-DD.md`
  (gitignored working area — a report, not a committed doc).
- Posts a concise summary back to Marco: PASS, or the specific drift found with
  the exact file/model/command to resolve each item.
- If everything is clean, it says so in one line — no noise.

## What it must never do

- Never edit `schema.prisma`, migrations, application code, `roadmap.md`,
  `progress.md`, or `project_instructions.md`.
- Never open or merge a PR automatically.
- Never regenerate committed artifacts on `main`.

It is an alarm, not a mechanic. Anything it finds is handed to the main
development chat to decide on and fix.
