---
premise: 'grep -q "does NOT reject when" docs/pipeline/DOCTRINE.md'
premise_means: DOCTRINE 9.5 blames a missing `gh` for the silent gate-waiver. The waiver is driven by `git`, and the doc also still claims the linter cannot see the human-gate markers, which it now can.
scope:
  - docs/pipeline/DOCTRINE.md
  - docs/pipeline/stations/_canonical-blocks.json
done_when: '! grep -q "does NOT reject when" docs/pipeline/DOCTRINE.md && node scripts/pipeline/lint-station.mjs'
size: 2
gate_allow: none
seed_only: false
escalates: false
rollback_strategy: ''
---

# DOCTRINE 9.5 blames the wrong binary for the silent ADMIT, and understates the human-gate detector

Station 04, `instrument-honesty` sweep, 2026-08-28. Two bullets in the `instruments v2` canonical
block are wrong in ways that matter at arming time. Everything below is `[MEASURED]` on
origin/main `1501d09c`, git 2.55 (`C:\Program Files\Git\cmd\git.exe`), PowerShell 5.1.26100.9168.

## 1. The gate-waiver is caused by `git`, not by `gh`. Fix this one first.

**Currently says:** *"`lint-prompt.mjs` does NOT reject when `gh` is missing — it WARNs `could not
probe ... skipping` and ADMITs with exit 0, so every `origin/main:` file-gate is silently waived.
An ADMIT obtained without `gh` on PATH proves strictly less than an ordinary ADMIT. Confirm `gh`
resolves before believing any ADMIT."*

**Measured — clean A/B isolation on one prompt with a genuinely unmet gate**
(`docs/pr-prompts/pr-company-manage-s2-retire-adminonly-HOLD.md`,
`requires_on_main: apps/api/src/common/permissions/permission-registry.ts :: company.manage`):

```
A. PATH = node + git only  (gh does NOT resolve, git DOES)
     -> REJECT  [GATE_NOT_RELEASED]   exit 1     <-- gate correctly reported unmet
B. PATH normal, LINT_GIT_BIN=zz-no-such-git  (gh resolves, git does NOT)
     -> WARN  GATE_NOT_RELEASED probe: could not reach origin/main:... ; skipping (fail-safe)
        ADMIT  (size 3)                exit 0     <-- gate silently waived
```

**The mechanism, in source.** `readFromOriginMain()` at `scripts/pipeline/lint-prompt.mjs:439-459`
shells `git show origin/main:<path>` via `LINT_GIT_BIN` (default `git`) and returns `null` on a
broken binary; both `checkFileGateDead()` (:495) and `checkGateNotReleased()` (:831/:870/:908) then
WARN and `continue` — fail-safe by design. `gh` is called in exactly ONE place, `ghFetchPrState()`
at :1042, which reads PR state for the `fixes_pr` check. It touches no `origin/main:` gate.

**Why it matters.** The doc hands the reader a check (`does gh resolve?`) that is *independent of
the thing it claims to protect*. A reader can confirm `gh` resolves, believe the ADMIT, and arm a
prompt whose gate was never evaluated. Note also that `0` prompts on the board currently carry
`fixes_pr`, so the `gh` path is not even exercised today.

**Replace with:** *"`lint-prompt.mjs` fails SAFE on a broken `git`: `readFromOriginMain` returns
null, the checker WARNs `could not probe / could not reach origin/main:<path> ... skipping` on
**stderr**, and the prompt ADMITs with exit 0 — so every `origin/main:` file- and content-gate is
silently waived. MEASURED: the same unmet-gate prompt REJECTs with `git` present and ADMITs with
`LINT_GIT_BIN` pointed at a non-existent binary. Confirm `git` resolves, and read stderr, before
believing any ADMIT. (`gh` is used only by the `fixes_pr` PR-state check at :1042 and waives no
gate.)"*

## 2. The linter CAN now see two of the three human-gate markers

**Currently says:** *"`lint-prompt.mjs` ADMIT is NECESSARY, NOT SUFFICIENT. Before arming anything:
read the BODY for `<!-- watcher: do-not-arm -->` or a caps do-not-arm line — the linter cannot see
them. Measured: 8 prompts carrying one still linted ADMIT, including one that drops database
tables."*

**Measured — the linter now hard-REJECTs before the premise runs**
(`lint-prompt.mjs:704-770`, `HUMAN_GATE_PRESENT`, three case-sensitive markers):

```
pr-524-rates-b-slice2-canonical-HOLD.md
  -> REJECT [HUMAN_GATE_PRESENT]  "line 3 contains <the caps marker>"   exit 1
```

That is the exact prompt the old bullet cites as the ADMITting table-dropper. **The headline is
still true and must stay** — proved by the counter-example in the same run:

```
pr-dns-s5-checker-flip-to-fail-HOLD.md   -> ADMIT (size 2)  exit 0
```

Its gate is prose the three markers do not match, so ADMIT still does not mean armable. Only the
*reason* has changed: the linter sees the two literal markers, and the "8 prompts" count is stale.

**Replace with:** *"`lint-prompt.mjs` ADMIT is NECESSARY, NOT SUFFICIENT. It hard-REJECTs
`HUMAN_GATE_PRESENT` on three CASE-SENSITIVE markers only (`<!-- watcher: do-not-arm -->`, a caps
do-not-arm line, and a conditional-arming line). The union of ways a human says 'not yet' is NOT
closed — MEASURED 2026-08-28: `pr-dns-s5-checker-flip-to-fail-HOLD.md` ADMITs with exit 0 while its
body carries a prose precondition. Read the body."*

## What must NOT change — re-measured this run, still biting

- `$` stripped from a `-Command "..."` string: `$v = 41 + 1` arrived as ` = 41 + 1`, parser error.
  Positive control without `$` printed `sum=42`. **Still true.**
- `ls-tree` without `-r`: **1** line vs **525** with `-r` on `origin/main -- docs/pr-prompts`;
  control found a known tracked path in the `-r` output. **Still true.**
- `git status` blind to gitignored: **4057** ignored files under `docs/pr-prompts`, **0** shown by
  `git status --porcelain`; `check-ignore -v` named `.gitignore:26`. **Still true.**
- `Get-Content` false mojibake: **290** a-hat-euro sequences reported in
  `sot/01-charter-and-architecture.md`; node reads the same 110387 bytes as **0** U+FFFD, **0**
  a-hat-euro, **278** real em-dashes. **Still true — edit with node.**
- `--jq` escaped double quotes: dies loudly; single-quoted jq with spaces works. **Still true.**
- `STOP-WATCHER` / `STOP-WATCHER-LANE2`: present at `C:\po-watcher` by design, read by the
  LAUNCHERS (`ensure-watcher.ps1:9,20-24`, `watcher-launcher-lane2.ps1:24`,
  `watcher-launcher-singlelane.ps1:29`) and by nothing in `scripts/pr-watcher/*.mjs` — which is
  exactly why it cannot stop a running watcher. **Doc is accurate; do not touch it.**

## How to land it

1. Edit both bullets **with node** (`readFileSync`/`writeFileSync`, utf8) — never PowerShell.
   `Set-Content` double-encodes the block and `lint-station` then fails on a hash you did not mean
   to change.
2. `instruments v2` is a CANONICAL-BLOCK. Bump BOTH markers to `v3`, then run
   `node scripts/pipeline/lint-station.mjs --write-canonical` and commit the regenerated
   `docs/pipeline/stations/_canonical-blocks.json`.
3. Verify `node scripts/pipeline/lint-station.mjs` exits 0 across all station docs.
4. `git diff --numstat` must be proportional to two bullets. A far larger number means the file was
   re-encoded — stop and redo with node.
5. The dev tree's index is SHARED. Commit with a pathspec.

## Authority

You have STANDING AUTHORITY to finish the work, commit, push and open the PR for this prompt.

## Scope audit

Docs only: `docs/pipeline/DOCTRINE.md` plus the regenerated
`docs/pipeline/stations/_canonical-blocks.json`. No `sot/`, so CP-24 is not engaged. No code, no
migrations, no seed, no `apps/`. Nothing outside `docs/pipeline/`.
