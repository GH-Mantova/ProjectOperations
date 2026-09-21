---
premise: '! grep -rq "QUEUE_LAYOUT_V1" sot/'
premise_means: The prompt-lifecycle folder standard is written in docs/pipeline/QUEUE-LAYOUT.md but is absent from the sources of truth, so a reader who takes sot/ as authoritative has no way to learn it exists.
scope:
  - sot/02-roadmap-and-status.md
done_when: node scripts/pipeline/lint-station.mjs && grep -rq "QUEUE_LAYOUT_V1" sot/ && grep -rq "QUEUE-LAYOUT.md" sot/
size: 2
gate_allow: none
seed_only: false
escalates: false
module: pipeline
station: '05'
requires_on_main: 'docs/pipeline/QUEUE-LAYOUT.md :: QUEUE_LAYOUT_V1'
---

<!-- watcher: do-not-arm -->

> **NEVER ARM THIS PROMPT.** `[MEASURED]` 2026-09-21T17:3xZ by Station 00: the watcher does **not**
> read a prompt's `station:` front-matter field — `Select-String 'station'` over
> `scripts/pr-watcher/index.mjs` returns **3** hits, all comments or message strings, and none a
> front-matter read (POSITIVE control `classifyPolicyFiles` → 2; NEGATIVE control, a freshly minted
> needle → 0). So arming this would hand a `sot/`-only build to **Station 01**, the watcher's
> code-writer, and `STATION-CAPABILITIES.md` §5 records `Edit /sot/` as **05 only**. The `station:
> '05'` field below is documentation, not routing. This marker is the cure DOCTRINE §9.5 prescribes
> for a never-arm prompt: `lint-prompt.mjs` REJECTs it `[HUMAN_GATE_PRESENT]` before the premise is
> ever evaluated. **Hand this file to Station 05; do not `git mv` it to `-ready.md`.**

# Queue layout - the sources-of-truth entry

**Station 05 only.** `sot/` belongs to the SoT Keeper and to nobody else. This prompt was authored
by Station 00 (`station-00.interactive-0003`) because the standard was specified there with Marco on
2026-09-17, but **Station 00 did not and will not edit `sot/`** - the wording is settled here and 05
executes it.

## Why this is a separate slice

`docs/pipeline/QUEUE-LAYOUT.md` is where the standard lives in full. `sot/` is where a reader looks
to find out that it exists at all. Those are different jobs and different owners, which is why they
are different PRs.

## Build this

Add a short entry to `sot/02-roadmap-and-status.md` recording, in 05's own house style:

- That the prompt queue has a **single folder standard**, carrying the marker `QUEUE_LAYOUT_V1`.
- The six states by name: **brainstorm, draft, hold, armed, merged, superseded** - with one line
  saying that `hold` and `armed` are filename states in the queue root, not folders, because the
  watcher's `fsWatch` is not recursive.
- That exception states nest under `exceptions/<reason>/` with a **closed** vocabulary.
- That `merged/` means a confirmed `MERGED` PR, and explicitly that it replaced a `processed/`
  folder which moved prompts when a PR merely **opened**.
- A pointer to `docs/pipeline/QUEUE-LAYOUT.md` as the full document.
- Marco's decisions of 2026-09-17, attributed: drafts come into the repo; exceptions nest; every
  historical prompt is re-checked and filed rather than a line being drawn at today.

Keep it to the length `sot/` entries normally run to. `sot/` states what is true, not how it was
built - the reasoning belongs in `QUEUE-LAYOUT.md`.

## Do NOT

- Do NOT restate the whole standard here. One entry plus a pointer.
- Do NOT touch any file outside `sot/02-roadmap-and-status.md`.
- Do NOT move or create any prompt folder. This slice is one document.
- Do NOT describe the standard as enforced - at the time this lands the guard is not yet in CI.

## VERIFY before opening the PR

```
node scripts/pipeline/lint-station.mjs
git diff --name-only origin/main   # must list exactly sot/02-roadmap-and-status.md
grep -n "QUEUE_LAYOUT_V1\|QUEUE-LAYOUT.md" sot/02-roadmap-and-status.md
```

CP-24 sot-purity runs on this diff. It is expected to pass; if it does not, read the job log and
report rather than working around it.

## STANDING AUTHORITY

**You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
**"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** There is no human in this run.
**Finishing the work and then asking for permission is indistinguishable from failing.**

## Guardrails

- One attempt. Never exit silently - if you cannot do it, say `NO-OP: <reason>` and why.
- Read the job log before diagnosing any CI failure.
- Hard stop, report and exit: Azure / Entra / SharePoint, production auth or secrets, any
  irreversible action.
- **Budget.** One document.

## STATUS

Authored by Station 00 for Station 05 to execute. Gates on `QUEUE_LAYOUT_V1` being on main, so it
cannot land before the document it points at.
