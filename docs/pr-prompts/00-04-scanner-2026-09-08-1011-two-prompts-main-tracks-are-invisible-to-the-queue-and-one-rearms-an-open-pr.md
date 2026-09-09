# Station 04 — Scanner | 2026-09-08T10:11:18Z–2026-09-08T10:30Z

## GROUND

```
UTC            2026-09-08T10:11:18Z
origin/main    06de97bb            (read two ways: .git/refs/remotes/origin/main in the mount,
                                    and list_commits sha=main via the GitHub MCP — identical)
dev tree       main @ 06de97bb     C:\ProjectOperations2
doc version    1                   (docs/pipeline/stations/04-scanner.md front matter)
bootstrap      1                   (scheduled-task SKILL.md) — MATCH
```

🔴 **THIS RUN WAS BLIND.** Desktop Commander could not be reached: the MCP server
`plugin:desktop-commander:desktop-commander` reported `CONNECT_TIMEOUT` after 30000 ms, and three
`ToolSearch` keyword loads (`desktop-commander start_process shell`, `... interact_with_process
read_file`) returned no tools. Per the PREFLIGHT contract the load came FIRST and the failure came
after it, so this is blindness, not an unloaded schema. **No shell ran on the Windows host.** No
`.ps1` was run, no `git` was run, no `gh` was run. This run therefore claims NO liveness, NO smoke,
NO safe-to-act and NO merge verdict, and it did not mutate the board.

Per `STATION-CAPABILITIES.md` §3 (`BLIND_RUN_OTHER_MOUNTS_V1`, landed #1814 at 06:59Z today) a
blind run COLLECTS before it stops. It did: **13 mounts** were enumerated under
`/sessions/<id>/mnt/` (`ProjectOperations2`, `po-fix923`, `po-fix933`, `po-preserve`, `po-sec-fix`,
`po-smoke`, `po-sup-fix`, `po-sup-fix-scripts`, `po-watcher`, `po-watcher-worktrees`,
`po-worktrees`, plus `outputs` and `uploads`) — the §3 paragraph says eleven, and the count is a
property of the session, as that paragraph itself says.

**Sweep taken this run: `gate-liveness`** — `node scripts/pipeline/next-sweep.mjs` reported
`SWEEP: gate-liveness` (rotation position 1 of 4; previous run 2026-09-08T06:18:43Z).

## WHAT I MEASURED

**Guard install (mandated first step).** `bash scripts/pipeline/vm-git-guard.sh` — its last line,
quoted as the contract requires:

```
FAIL: guard blocked a call that targets nothing mounted        (exit 1)
```

That is F3 below. Re-run from `$HOME` with the absolute path the doc prescribes, the last line is
`persistence controls passed: .bashrc byte-identical on re-run; login shell resolves shim` — but it
is printed 1017 times (F4). The shim itself is installed at `$HOME/.local/bin/git` and does refuse
mounted paths. **[MEASURED]**

**Ground, cross-transport.** `.git/refs/heads/main` and `.git/refs/remotes/origin/main` both read
`06de97bb838c4835650c346280c53993d2103f82`; GitHub `list_commits sha=main perPage=3` returns the
same SHA as head (`docs(pr-prompts): stage the brandtheme S0-S6 chain … (#1817)`, 07:08:30Z). No
`index.lock`, no `MERGE_HEAD`/`REBASE_HEAD`/`CHERRY_PICK_HEAD`, no rebase dirs. `packed-refs` is
still stale at `4ea28d6d` / `66194af6` — loose refs win; this re-confirms the standing fact rather
than adding to it. **[MEASURED]**

**Per-file fidelity to origin/main, without running git (new method, F5).** CRLF-normalise the
mount's copy, hash it OUTSIDE the mount, compare to the blob `sha` GitHub returns in a directory
listing:

```
sed 's/\r$//' sot/01-charter-and-architecture.md > /tmp/sot01.lf ; (cd /tmp && git hash-object sot01.lf)
  -> 07e52d778c097dc5a885ec28a9875efac2cccece   size 109681
get_file_contents sot/ ref=refs/heads/main
  -> {"name":"01-charter-and-architecture.md","sha":"07e52d77…","size":109681}
```

Identical. So for that file the working copy IS origin/main's content, measured by two transports,
and a grep run against the mount answers for `origin/main`. **[MEASURED]**

**Premises.** All 40 depth-1 `*-HOLD.md` in the working copy were parsed (front matter is CRLF —
a bash `$0=="---"` comparison reads every one of them as having NO front matter; use `sed 's/\r$//'`
first) and each `premise:` executed with cwd = repo root. **39 LIVE, 1 DEAD, 0 errored.** Controls:
`test -f apps/api/prisma/schema.prisma` → 0; `! test -f` the same path → 1; a grep at a nonexistent
path → 2, proving cwd resolution. **[MEASURED]**

**Gates.** 8 `requires_file_on_main` (all UNMET — 5 are `docs/approvals/…-approved-by-marco.md`
files that do not exist and are Marco's to write; `docs/approvals/` holds only `README.md` and
`watcher-identity-approved-by-marco.md`), 18 `requires_on_main` (9 MET, 6 UNMET, 3 NOFILE), 4
`requires_merged` (#1361 merged 2026-08-28, #1317 merged 2026-08-25 — both `merged:true` via the
GitHub MCP; #1257 and #1111 not read as PR objects, but their shipped artifacts are present on the
main-equal tree: `RateResolverService` appears 3× in `scope-of-works.service.ts`, and
`apps/web/src/pages/admin/ApiKeyVaultPanel.tsx` exists — **[INFERRED]**, not a merged-state read).
No gate was found dead. The three NOFILE gates are forward references from
`pr-tipid-s3-…` and the brandtheme chain, which is the intended state for chained slices.
**[MEASURED except as tagged]**

**Board trap.** `get_file_contents docs/pr-prompts/ ref=refs/heads/main` returns **zero**
`*-ready.md` at depth 1. The working copy also has none. The classic board trap is NOT present.
**[MEASURED]**

**The count differs by transport.** origin/main tracks **42** depth-1 `pr-*-HOLD.md`; the working
copy has **40**. See F1. **[MEASURED]**

**Open PRs at 10:2xZ:** #1819 (`feat/brand-theme-s1-apply-scheme`, opened 07:49Z), #1818, #1815,
#1809. **[MEASURED]** — a list, not a verdict; this run may not say whether any of them is
mergeable.

**Timestamps.** Every time in this report is taken from log CONTENT or from the GitHub API, never
from a mount `stat`. The one `stat` I did take is recorded as unusable: `.git/FETCH_HEAD` printed
`2026-09-08 07:15:56 +0000` under `TZ=UTC`, which is either 3 h or 13 h old depending on the
host-offset question §3 warns about — **[CANNOT MEASURE]**.

## WHAT CHANGED

Two files written into the dev tree, both **untracked**, neither committed — this run cannot open a
PR (blind, and the GitHub MCP token is write-403). **Station 00 must sweep all three files up:**

1. `docs/pipeline/sweep-rotation.json` — advanced with
   `node scripts/pipeline/next-sweep.mjs --advance --utc 2026-09-08T10:11:18Z`.
   `last_index` 3 → 0, `last_run_utc` → `2026-09-08T10:11:18Z`. LEFT DIRTY, as the station doc
   requires; 04 may not commit to the shared dev tree.
2. `docs/pr-prompts/pr-vmgitguard-selftest-and-recursion-HOLD.md` — a staged prompt for F3 + F4.
   Per `PROMPT-SCHEMA.md` it is **NOT queued** until it is committed to `origin/main`.
3. This breadcrumb.

Nothing else. No prompt armed, renamed, moved or deleted. No label touched. No merge. No `sot/` edit.

## FINDINGS

### F1 — Two prompts that origin/main still tracks are invisible to the queue, and arming one of them would duplicate an OPEN Marco-gated PR

origin/main tracks 42 depth-1 `pr-*-HOLD.md`; the working copy has 40. The two missing from the
working copy are not missing — they were armed (`HOLD` → `ready`) and retired by the watcher into
`docs/pr-prompts/processed/`, which is gitignored, so **the retirement was never committed and both
files are still tracked on `main` at depth 1**:

| Prompt (tracked on main) | Local state | Premise vs main @06de97bb | Its PR |
|---|---|---|---|
| `pr-stationcaps-blind-run-names-one-mount-HOLD.md` | `processed/…-ready.md` + `.log`, ended 05:48:39Z, `{"ok":true}` | **DEAD** — `grep -c BLIND_RUN_OTHER_MOUNTS_V1 … \| grep -q "^0$"` exits 1; marker count 1, fresh-needle control 0 | #1814, MERGED (commit `27cf57c3`) |
| `pr-brandtheme-s1-apply-the-saved-scheme-HOLD.md` | `processed/…-ready.md` + `.log`, ended 07:50:26Z, `{"ok":false,"marco":true,"reason":"outside tests/ or docs/: …branding.controller.ts"}` | **LIVE** — `! grep -rq "documentElement.style.setProperty" apps/web/src` exits 0; `setProperty` 0 files, POS control `useEffect` 215 files, NEG control 0 | **#1819, OPEN, routed to Marco** |

The second row is the sharp one. That prompt is `gate_allow: none`, carries no `requires_*`, its
premise passes, and it is tracked at depth 1 — so it is fully armable **right now**, while the work
it orders is sitting in an open PR that RULE 2 says nobody may merge. Arming it opens a second PR
for in-flight Marco-gated work: the `#1483` failure mode, with a live instance.

This is the known "an armed prompt whose PR does not delete it stays armable forever" defect, and
#1817 (merged 07:08Z today) is the burn-down: it retired three consumed HOLDs into `superseded/`.
Neither of these two was in that batch — #1814's prompt was consumed at 05:48Z, before #1817
merged, and #1819's at 07:50Z, after.

The general lesson for this sweep, and for anyone reading a board size: **a queue census taken from
the working copy under-counts the board by exactly the prompts the watcher has retired locally.**

**DISPATCHED** → Station 00. Retire both into `docs/pr-prompts/superseded/` with `git mv` in the
next board PR (00 is the only actor that may commit here). Check first whether `sot/` cites either
path — that is what forced #1817 to leave `pr-sot-01-nav5-reconcile-…-HOLD.md` at depth 1, and a
dangling ref fails `check-sot-refs`.

### F2 — The only dead premise on the board is already known on main, and it is 05's to clear

`pr-sot-01-nav5-reconcile-2026-08-20-HOLD.md` — premise
`grep -q "^2\. ESTIMATING" sot/01-charter-and-architecture.md` exits 1. `sot/01` line 364 now reads
`2. TENDERING            (renamed from "Estimating" — NAV-1, 2026-08-14)`; the reconcile shipped in
#1810. Confirmed against origin/main by blob identity (F5 method), not merely against the working
copy. This is not new: #1817's own commit message records that the prompt was deliberately kept at
depth 1 because `sot/01`:457 cites it as provenance, and that repointing that line is a `sot/` edit
belonging to Station 05's doc-reconcile lane.

**DISPATCHED** → Station 05. Repoint `sot/01-charter-and-architecture.md`:457 (it also still
describes the reconcile as pending, which is stale twice over), then the prompt can be retired.
04 does not stage anything 05-owned.

### F3 — `vm-git-guard.sh` fails its own self-test from the cwd every station will have, and blames the wrong thing

`cd .../mnt/ProjectOperations2 && bash scripts/pipeline/vm-git-guard.sh` exits **1** with
`FAIL: guard blocked a call that targets nothing mounted`. The cause is not what the message says.
The shim refuses on `$PWD` as well as on arguments — `case "$PWD/" in "$HOME"/mnt/*)` — so from any
cwd under a mount it refuses **every** git call, `git --version` included, which is precisely the
negative control at line 92. The install is fine; the control is scoped wrong.

Two consequences. The station doc's promise that "git elsewhere in the VM is untouched" holds only
by argument, not by cwd — a scratch clone under `/tmp` is unusable without first `cd`-ing out of the
mount. And a station that follows the instruction to quote the installer's last line reports a FAIL
that names a defect the guard does not have, which is the §7 pattern the guard exists to end.

**DISPATCHED** → staged as `pr-vmgitguard-selftest-and-recursion-HOLD.md` (see F4; one file, one
prompt). Not a stop: the station doc says a failed install is a finding, and I ran no `git` against
the mount regardless.

### F4 — The same installer re-executes itself ~1000 times on every successful run

Line 96 is `bash "${BASH_SOURCE[0]}" 2>/dev/null || true`, inside the idempotency control — so each
invocation runs a full nested copy of itself, which runs another. Measured from `$HOME`: **1017**
nested invocations, 3053 lines, 318,364 characters of output, terminating only when the VM runs out
of whatever it runs out of, with `|| true` swallowing the failure. Only stderr is silenced, so the
success lines print 1017 times and the run still exits 0.

Every station is told to quote "the installer's last line". That line is the innermost copy's, and
it says everything passed. The recursion is invisible to the exact instrument the contract
prescribes.

**DISPATCHED** → staged in the same prompt as F3. The fix is to guard the re-exec behind an
environment variable, and to neutralise `$PWD` in the negative control.

### F5 — A blind run can prove per-file identity with origin/main, and nothing says so

The blind-run ceiling correctly forbids `git` against the mount, which leaves a blind run unable to
answer "is this working copy the same as `main`?" — the question every grep-based premise depends
on. It can be answered without git: CRLF-normalise the file, hash it with `git hash-object` in
`/tmp` (outside the mount, where the guard permits git), and compare against the blob `sha` the
GitHub MCP returns for that path in a directory listing. Demonstrated above on `sot/01`
(`07e52d77…`, 109681 bytes, both sides). It is per-file, it is cheap, and it converts "the dev tree
may be stale" from an unmeasurable caveat into a measurement.

**DEFERRED** — real, and worth a paragraph in `STATION-CAPABILITIES.md` §3 next to
`BLIND_RUN_OTHER_MOUNTS_V1`, but this run already stages one prompt and the arming lane is starved;
a second docs-only prompt from the same run is 00's call, not mine. It becomes urgent the next time
a blind run has to decide whether a premise result transfers to `main`.

## WHAT I DID NOT DO

- **No host-side anything.** No `status-sweep.ps1`, `bring-up-to-speed.ps1`, `smoke-pr.ps1`,
  `restart-watcher-if-wedged.ps1`, `arm-prompt.ps1`, no `gh`, no `git` against the Windows `.git`.
  So: no liveness verdict on the watcher, no smoke result, no safe-to-act, no merge verdict, and
  nothing said about whether any open PR may be merged.
- **`lint-prompt.mjs` was not run on the 40 prompts.** It evaluates `requires_*` against
  `origin/main` with `git`, which the guard refuses from the mount and which the blind ceiling
  forbids in any case. The premise and gate results above are my own harness, and are tagged as
  such — no lint verdict is quoted anywhere in this report.
- **I did not skip the breadcrumb validator.** `node scripts/pipeline/check-breadcrumb.mjs` exited
  **0**, `CLEAN`, `ADMIT` for this file, with `NOTE … is UNTRACKED — it reaches nobody until a board
  PR commits it`. `node scripts/pipeline/lint-prompt.mjs` on the staged prompt exited **0**,
  `ADMIT (size 1)` — which admits the prompt as well-formed and is NOT an instruction to arm it.
- **No RULE 2 probe sweep.** I read exactly two `processed/*.log` files, both for F1, and quoted
  their `[watcher] merge result` lines verbatim. I did not survey `marco:true` across the board and
  make no claim about routing for any PR other than #1819.
- **Nothing 05-owned staged**, per the authority section.
- **The watcher clone (`po-watcher`) was not read this run.** §3 now says it is readable and that
  DOCTRINE §9.5's three homes must all be checked before writing "no verdict for PR N" — I make no
  such claim about any PR, so the omission costs nothing here, but the next run doing verdict work
  should walk all three.
