---
premise: grep -q "watcher-launcher\.ps1" docs/pipeline/stations/03-machine-minder.md
premise_means: 03-machine-minder.md still names the wrapper that is NOT the one the machine runs.
scope:
  - docs/pipeline/stations/03-machine-minder.md
  - docs/pipeline/stations/04-scanner.md
done_when: node scripts/pipeline/lint-station.mjs && ! grep -q "watcher-launcher\.ps1" docs/pipeline/stations/03-machine-minder.md && grep -q "watcher-launcher-singlelane\.ps1" docs/pipeline/stations/03-machine-minder.md && ! grep -q "state files (all gitignored)" docs/pipeline/stations/04-scanner.md
size: 2
gate_allow: none
seed_only: false
escalates: false
---

# Two station docs assert things that are measurably false

Docs-only. Two files. No code, no `sot/`, no schema. Both defects were MEASURED on the box on
2026-08-26 at 14:12-14:16Z against dev tree `7ad50697` / `origin/main cfc74982`.

---

## DEFECT 1 — `03-machine-minder.md:234` names a wrapper the machine does not use

Line 234 currently reads (in the relaunch instruction):

> the WRAPPER first, then the node, then relaunch DETACHED via `C:\po-watcher\watcher-launcher.ps1`

That is the wrong file, and lines **118-119 of the same document already say so**:

> - The launcher is **`watcher-launcher-singlelane.ps1`**. Older instructions named a different file and
> called it "the REAL launcher path"; that was wrong.

### The measurement that settles it

- The scheduled task that actually restarts the watcher is `PO Watcher Keepalive`, State=Running,
  action: `powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "C:\po-watcher\ensure-watcher.ps1"`.
- `C:\po-watcher\ensure-watcher.ps1:10` sets `$Launcher = 'C:\po-watcher\watcher-launcher-singlelane.ps1'`.
- `C:\po-watcher\ensure-watcher.ps1:59` carries this comment, in the source, unprompted:
  `# The station doc names 'watcher-launcher.ps1'. The RUNNING wrapper is the -singlelane one.`
- **Both files exist on disk** (`watcher-launcher.ps1` = True, `watcher-launcher-singlelane.ps1` = True).
  That is why this has survived: a `Test-Path` guard passes on the wrong one, so an agent following
  line 234 relaunches through a wrapper the Keepalive task will not recognise, and nothing errors.

### What to change

In `docs/pipeline/stations/03-machine-minder.md`, correct line 234 so the relaunch path is
`C:\po-watcher\watcher-launcher-singlelane.ps1`, and add a short parenthetical naming
`ensure-watcher.ps1:10` as the source of truth for that value.

🔴 **The literal string `watcher-launcher.ps1` must not survive anywhere in the file** — not even
inside an explanatory "not the old one" aside. Write the aside as "the non-singlelane wrapper" or
drop it. The premise of this prompt greps for that literal; if you leave it in, this prompt re-fires
forever after it lands (LL-54).

---

## DEFECT 2 — `04-scanner.md` HARD RULES claims all `docs/qa/` state files are gitignored. They are not.

The HARD RULES block says:

> Tracked-file writes: NONE except staged prompt files and docs/qa/ state files (all gitignored).

**MEASURED:** `.gitignore` ignores exactly five entries under `docs/qa/` — lines 106-110:
`qa-checklist.md`, `qa-findings.md`, `qa-test-data-registry.md`, `.qa-run.lock`, `qa-run-*.md`.
`docs/qa/` itself is **not** ignored, and `git ls-tree -r origin/main -- docs/qa` returns five
TRACKED entries (`integration-idempotency-audit.md`, `workstream-c-coverage-audit.md`, and three
screenshots).

That matters because the same document, at line 182, instructs the scanner to write a file that is
**not** in the ignore list:

> a. Recently merged PRs since the marker in `docs/qa/qa-github-audit.md` (create if absent, one dated block per run)

`docs/qa/qa-github-audit.md` is not on disk, not on `origin/main`, and not gitignored
(`git check-ignore --no-index -v` returns nothing for it; the same probe correctly returns
`.gitignore:108` for `qa-findings.md`, so the instrument is not blind). Obeying line 182 therefore
creates a **tracked** file, which the HARD RULES block in the same document forbids.

A second dead path in the same document, line 159:

> If missing, rebuild from `docs/qa/Master-QA-and-Consolidation-Program-Plan.md`

That file does not exist on disk, on `origin/main`, or in `.gitignore`. `.gitignore:106` even carries
the comment "The Master Plan doc stays committable" — a comment about a file that is not there.

### What to change

In `docs/pipeline/stations/04-scanner.md`:

1. Replace the parenthetical `(all gitignored)` with the accurate statement: name the five ignored
   entries from `.gitignore:107-111` and say plainly that anything else under `docs/qa/` is TRACKED.
   The `done_when` greps for the absence of the exact substring `state files (all gitignored)`.
2. At line 182, stop telling the scanner to create `docs/qa/qa-github-audit.md`. Either name a path
   that IS ignored (e.g. fold the audit marker into `qa-findings.md`, already ignored at
   `.gitignore:108`) or say the marker lives in the tracked breadcrumb. Pick one and be explicit —
   do not leave "create if absent" pointing at an un-ignored path.
3. At line 159, mark `docs/qa/Master-QA-and-Consolidation-Program-Plan.md` as ABSENT (verified
   2026-08-26 against `origin/main cfc74982`) and say what to do instead when the checklist is
   missing, rather than pointing at a file nobody can read.

---

## Do NOT

- Do NOT touch any `<!-- CANONICAL-BLOCK: ... -->` region. `lint-station.mjs` hashes those and will
  fail the build. Both edits sit outside them; confirm that before you save.
- Do NOT edit `docs/pipeline/DOCTRINE.md`, `STATION-CAPABILITIES.md`, or any other station doc.
- Do NOT edit anything under `sot/` — CP-24 hard-fails a PR that mixes `sot/` with anything else.
- Do NOT touch `.gitignore`, `ensure-watcher.ps1`, or any script. This prompt corrects documents to
  match the machine; it does not change the machine.
- Do NOT create `docs/qa/qa-github-audit.md`, `docs/qa/Master-QA-and-Consolidation-Program-Plan.md`,
  `docs/pr-prompts/triage-state.md`, or `docs/pr-prompts/AWAITING-MARCO-DECISION.md`. The last two
  are a separate open question for Marco and are deliberately out of scope here.
- Do NOT use PowerShell `Get-Content`/`Set-Content` to edit these files — it double-encodes UTF-8 and
  adds a BOM (DOCTRINE §9.3). Edit with node `readFileSync`/`writeFileSync`, utf8, and check
  `git diff --numstat` reads as small as your intended change before committing.

## Guardrails

- One attempt. Never exit silently — say `NO-OP: <reason>` if you cannot proceed.
- Never ask a question or stand by for approval. There is no human in this run.
- Read the CI job log before diagnosing any red check; never reason a failure out of the diff.
- Before you commit, run `git diff --cached --name-status`. The dev tree's index is SHARED with
  other chats — if anything other than your two files is staged, commit with an explicit pathspec.

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

## The completion test

Is there a PR number in your output? If no, and the work was already on `main`, say
`NO-OP: <reason>`. If no because you are waiting for someone — there is nobody. Open the PR.

---

*Staged by Station 04 (Scanner), instruction-drift sweep, 2026-08-26T14:20Z, against dev tree
`7ad50697` / `origin/main cfc74982`. Every claim above is `[MEASURED]` on the Windows host via
Desktop Commander; the probes and their positive controls are recorded in the run breadcrumb
`docs/pr-prompts/00-04-scanner-2026-08-26-1410-*.md`.*
