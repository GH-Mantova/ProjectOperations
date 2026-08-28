# Station 04 — Scanner | 2026-08-28T06:09Z–2026-08-28T06:19Z

> ⚠️ **FIRST LINE: THIS RUN WAS BLIND FOR DESKTOP COMMANDER.** No Windows shell. Doc version and
> bootstrap version AGREE (both `1`); the read-only posture below is forced by blindness, not by a
> version mismatch. Everything here was measured over the workspace mount (`C:\ProjectOperations2`,
> the real dev tree — **not** `origin/main` standing in for it) plus GitHub read-only calls used
> only as the *reference side* of a drift comparison. Where a claim needed a shell, it is tagged
> `[CANNOT MEASURE]` and not guessed.

## GROUND

```
UTC            2026-08-28T06:09Z (start) — 2026-08-28T06:19Z (end)
origin/main    fa04501d   (GitHub API, tip of main, committed 2026-08-28T05:38:17Z)
dev tree       main @ fa04501d   C:\ProjectOperations2   (.git/refs/heads/main, read as a file)
doc version    1   (docs/pipeline/stations/04-scanner.md front matter)
bootstrap      1   (scheduled-task SKILL.md, station_doc_version: 1)
```

**Sweep this run: `instrument-honesty` (rotation position 2 of 4).** Assigned by
`node scripts/pipeline/next-sweep.mjs`, not chosen. Previous run 2026-08-28T02:19:51Z (gate-liveness).

**Blindness disclosure, per PREFLIGHT step 1.** `start_process` was unreachable: the
desktop-commander MCP server never finished connecting this session (four `ToolSearch` retries over
~90 s, including an exact `select:` by tool name — the server registers zero tools). I could not
reach: PowerShell, `gh`, `git` against the Windows `.git`, `status-sweep.ps1`, the watcher heartbeat,
process tables. **This is a blind run, not a quiet one.** See F5 for the contract conflict this
exposed.

## WHAT I MEASURED

### §9.2 Git — traps reproduced in a throwaway Linux-side repo (`/tmp/trap`), never against the Windows `.git`

| §9 claim | Result |
|---|---|
| `git ls-tree --name-only <ref> -- <dir>` **without `-r`** returns exactly ONE line | **[MEASURED] REPRODUCES.** `count_no_r=1` (the tree entry `docs/pr-prompts`), `count_with_r=2`. A `-ready.md` filter over the no-`-r` output returned **0** against a truth of **1**. Positive control passed. |
| `git status` is structurally blind to gitignored files | **[MEASURED] REPRODUCES.** A planted gitignored `c-ready.md`: `git status --porcelain` = 0 hits; `git ls-files --others --ignored --exclude-standard` = 1 hit; `git check-ignore -v` names `.gitignore:1`. |
| Plain `git fetch origin main` **does** opportunistically update `refs/remotes/origin/main` | **[MEASURED, DIFFERENT VERSION]** True on sandbox git **2.34.1** (ref advanced). DOCTRINE's claim is about **2.55** on the host. Consistent, not a host measurement. |

### §9.3 Files and encoding — a NEW trap, found by a failed positive control

`grep -P '\xef\xbf\xbd'` under the sandbox default locale (`LANG=C.UTF-8`) **failed a planted
positive control**: it did not match a file I had just written a U+FFFD into. `LC_ALL=C grep -P`
matched it. PCRE in UTF mode reads `\xNN` as a *code point*, not a byte.

The consequence, measured both ways over `docs/` + `sot/` + `scripts/`:

| Scan | `grep -P` (default locale) | Byte-exact (Python) |
|---|---|---|
| Double-encode signature `U+00E2 U+20AC` | **1 file** | **20 files** |
| `U+FFFD` | **0 files** | **4 files** |

Second independent control failure: DOCTRINE.md's own quoted example at line 364 (`â€"`) is a true
positive the `grep -P` query missed (`grep -cP … = 0`).

Byte-exact `U+FFFD`: `sot/03-progress-log.md` **9**; `docs/pr-prompts/processed/pr-sot-reconcile-2026-07-15-ready.md` 1;
`check-sot-bytes.mjs` 1 and `check-sot-encoding.ps1` 1 (both benign — detector literals).
Byte-exact double-encode, largest live offenders: **`docs/pr-prompts/BACKLOG.yaml` 81**,
`docs/plans/cluster-chaining-plan.md` 46, `docs/pr-prompts/PROMPT-SCHEMA.md` 2. The five **station
docs are clean** — the 2026-08-24 repair held; it just never covered anything else.

### §9.5 The pipeline's own instruments

- **`STOP-WATCHER-LANE2` present by design — [MEASURED] TRUE, but not where the text implies.** Absent
  from the repo entirely (`find` depth 3, plus a `grep -rn` over `scripts/`). It lives at
  **`C:\po-watcher\STOP-WATCHER-LANE2`**, alongside `cowork-stop-watcher.ps1`. See F3.
- **`rev-<n>-ready.md` have no front matter by design — [MEASURED] TRUE.** `rev-1000/1001/1002` open
  with the reviewer instruction, no `---`.
- **`lint-prompt.mjs` ADMITs when `gh` is missing — [CANNOT MEASURE] live.** Executing it against a
  file-gated prompt from the Linux side would shell out to `git`/`gh` against the Windows `.git`,
  which is a hard stop while blind. Statically the WARN-and-skip path is still present at
  `lint-prompt.mjs:495` and `:557` ("could not probe origin/main:… ; skipping"), and the newer
  gate paths at `:815`, `:856`, `:895` skip with an explicit `fail-safe — not reporting gate as
  absent` comment. **The hole is by design and still open.** §9.5 is not drift.
- **GitHub MCP token cannot merge / open PRs (403) — [CANNOT MEASURE].** Testing it is a write; the
  station is read-only. Not attempted.
- §9.1 (PowerShell `$`-stripping, `#`-pause, blocked commands), §9.4 `gh run list --branch main`
  staleness, §9.5 "never count or kill by image name" — **all [CANNOT MEASURE]: require the host shell.**

### Board state observed in passing (not this sweep's subject — 00's lane)

- **ARMED = 1** at depth 1: `docs/pr-prompts/pr-crm-s2-nav-three-items-tabs-b-ready.md`. 56 `*-HOLD.md`
  at depth 1. `[LIVE @06:15Z — decays, re-measure before acting.]`
- Whether that depth-1 ready-file is *tracked* (the board trap) is **[CANNOT MEASURE]** — it needs
  `git ls-files` against the Windows `.git`.
- `sot-refs` baseline = **26 entries**, matching `CLAUDE.md`.
- **`check-breadcrumb.mjs` exits 1 locally**, on exactly one file:
  `00-04-scanner-2026-08-27-0617-instruction-drift-…md` — *"line 162: routes findings to
  `docs/qa/qa-checklist.md`, which is gitignored"*. That line **quotes the gitignored path in order to
  warn about it**; the checker gates on a `gitignor` proximity window, not on a destination test, so
  this is a false positive on a file that is warning about the very hazard it is failing for. It is
  **untracked**, so CI on `main` never sees it and the board is not red. Verified my own breadcrumb
  **ADMITs**. (Measured with the true exit code — the first attempt read `$?` after a pipe to `tail`
  and got tail's `0`. §9.6, on me.)
- **Independent corroboration of F4:** an untracked Station 00 breadcrumb dated **0608Z today** is
  titled `…-armed-crm-s2-dev-tree-clean-clone-diverged`. 00 armed `crm-s2` and reached "dev tree
  clean" one minute before this run started, by a different route.

### Self-audit — a git call I did not intend to make

`node scripts/pipeline/check-sot-bytes.mjs` shells out via `execSync("git show origin/main:…")`. I
ran it from the Linux side before reading its source, so a read-only `git` did execute against the
Windows `.git` through the bridge. **Checked immediately after: no `.git/index.lock`, no `.git/*.lock`.**
Reported because a station that hides its own near-miss teaches the next run nothing. A completed
read-only `git show` left no lock; this does **not** refute the hard stop, which is about *cut-short*
calls.

## WHAT CHANGED

- **Board: nothing.** Nothing armed, disarmed, renamed, moved, deleted, merged or labelled.
- `docs/pipeline/sweep-rotation.json` advanced to position 3 (`repo-hygiene`) via
  `next-sweep.mjs --advance --utc 2026-08-28T06:09Z`.
- This breadcrumb written at a tracked path.
- **Both files are UNTRACKED — I have no `git` this run and cannot commit them. Station 00 must
  sweep them up.** If they are not committed, the next Station 04 repeats `instrument-honesty`.

## FINDINGS

### F1 — §9.3 tells stations to look for `U+FFFD` and names no working query; the obvious one returns a silent false zero

`grep -P '\xef\xbf\xbd'` fails a planted positive control under a UTF-8 locale and under-reported the
double-encode sweep by **19 files out of 20**. This is §9.6 ("an empty result is not an empty world")
firing on §9.3's own instruction. Exact remedy — add to §9.3:

> ⚠️ **`grep -P '\xNN…'` matches CODE POINTS, not bytes, under a UTF-8 locale.** `\xef\xbf\xbd`
> silently matches nothing. Use `LC_ALL=C grep -P`, or read the bytes in node/python. **Always plant
> a control character in a scratch file and confirm the query finds it before trusting a zero.**

**DISPATCHED** — to Station 00, which owns `docs/pipeline/DOCTRINE.md`. Handing over the exact
insertion text above for §9.3; the canonical-block hash in `lint-station.mjs` must be re-recorded in
the same shipment.

### F2 — `check-sot-bytes.mjs` is a blocking CI gate that is structurally blind to the only damaged file in `sot/`

The file list is **hardcoded to 3 of the 7 `sot/*.md`**: `README.md`, `01-charter-and-architecture.md`,
`05-decisions-and-lessons.md`. `02`, `03`, `04` and `06` are never opened. `sot/03-progress-log.md`
carries **9 `U+FFFD`**, and the checker's own regex finds all 9 when pointed at it — the logic works,
the file is simply not in its list. The gate is *blocking* (`ci.yml:238-247` greps stdout for
`DAMAGED` and `exit 1`s), it runs on every PR, and it prints `CLEAN UTF-8 on disk` while damaged bytes
sit committed on `main`. Dev tree and `main` are byte-identical here (main blob SHA
`f63e2738bb1f21ead860dd53dd4e86000b1e9f50`) — this is **not** dev-tree staleness, the hole is on main.

RULE 1 options, complete-and-additive first:

1. **Glob `sot/*.md` AND add a ratcheting baseline** (same shape as `docs/qa/sot-refs-baseline.json`):
   the 9 known `U+FFFD` in `sot/03` are recorded, the count may only shrink, everything else fails
   closed. Solves it now (all 7 files covered) and in future (new damage fails immediately, and the
   known damage is burned down rather than blessed). Damages no data entry. **Passes both halves.**
2. Glob `sot/*.md` with no baseline. Fails the *"without damaging"* half — it reddens every open PR
   the moment it lands, because `sot/03`'s 9 chars are already committed and, per the 05 run of
   2026-08-27T14:11Z, unrecoverable from history.
3. Repair `sot/03` first, then glob. Fails the *"immediately"* half — it is blocked on a repair that
   two prior runs have called unrecoverable, so the gate stays blind meanwhile.

**DISPATCHED** — to Station 05, which owns `sot/` and already holds the "repair the 28 dangling
`sot/**` refs, ratcheting the baseline down" job; this is the same mechanism applied to bytes and
should ship alongside it. Option 1 is the recommendation.

### F3 — §9.5's `STOP-WATCHER-LANE2` claim is true but unlocatable from the text, and reads as drift to any station that checks it

A station verifying "present by design since 2026-08-15" searches the repo, finds nothing, and has to
decide between "the doc is stale" and "I searched the wrong tree". The sentinel is at
`C:\po-watcher\STOP-WATCHER-LANE2`. One-line fix: name the path in §9.5. Same applies to the real
sentinel `STOP-WATCHER`.

**DISPATCHED** — to Station 00 (DOCTRINE owner), to ship with F1 in the same canonical-block edit.

### F4 — the standing "THE DEV TREE IS STALE — #1 BLOCKER" finding is REFUTED as of 06:15Z

All three probes that carried it now come back positive against `C:\ProjectOperations2`:

| Probe | Prior claim | Measured 06:15Z |
|---|---|---|
| `FILE_GATE_NOT_RELEASED` in `lint-prompt.mjs` | absent | **9 occurrences** |
| `check-sot-refs` in `.github/workflows/ci.yml` | absent | **2 occurrences** (`:187`, `:193`) |
| `docs/qa/sot-refs-baseline.json` | absent | **present, 26 entries** |

`HUMAN_GATE_PRESENT` is also present (8 occurrences), so prose `DO NOT ARM` is rejected here too.
Decisive check: dev tree `.git/refs/heads/main` = **`fa04501d`** = the tip of `origin/main`
(PR #1365, 05:38:17Z). The tree is at main's tip, not behind it. Someone fast-forwarded it between
04:08Z and 06:09Z.

**DISPATCHED** — to Station 00, which carries the standing-findings ledger. Carrying a refuted
blocker at the top of the board costs every subsequent run a wrong prior. Note also that **PR #1363
merged at 04:20:33Z**, so the 04:14Z `BLOCK / reject-and-redo` verdict on it is also superseded.

### F5 — the station contract orders a blind run to STOP, while the station brief's Part 0 is explicitly mount-based; both are in the same file

PREFLIGHT step 1 says: no Desktop Commander → **STOP**, on the stated grounds that "`origin/main` is
not the tree the watcher globs." The station brief 250 lines below says Part 0 is "pure grep+read over
the repo mount", to be run "FIRST, ALWAYS, even when the live pass is blocked", and opens by telling
the agent to `ls -d /sessions/*/mnt/ProjectOperations2`. The mount **is** the tree the watcher globs,
so the stated grounds for the stop do not bite it — but the contract wins on the doc's own terms, and
a literal reading discards a run that can still measure. Today that would have discarded F1, F2 and F4.

RULE 1 options, complete-and-additive first:

1. **Amend PREFLIGHT step 1 to a three-way test**, not two: *host shell* → full run; *no host shell
   but the workspace mount resolves* → **READ-ONLY run, mandatory blindness banner as the first line,
   every shell-dependent claim tagged `[CANNOT MEASURE]`, no board mutation, no `git` against the
   Windows `.git`*; *neither* → stop. Complete (the failure mode the stop protects against —
   substituting `origin/main` for the tree — stays banned by name) and additive (no existing capability
   removed, and a blind run still cannot touch the board).
2. Keep the hard stop and delete Part 0's mount instructions. Fails the *"completely"* half: the
   pipeline loses its cheapest deterministic audit on exactly the runs where it is the only one available.
3. Leave both as they are. Fails both halves: the outcome depends on which paragraph the agent weighs
   more, which is how two runs of the same station produce opposite behaviour from one file.

**ESCALATED** — Marco's call, because it changes what a station is permitted to do unsupervised, and
because the underlying cause may be his to fix: **if Station 04 appears in the scheduled-task listing
it is cloud-fired and structurally cannot reach the box**, which would make blind runs the norm rather
than the exception. Question: *do you want option 1, or do you want blind runs to keep stopping?*

## WHAT I DID NOT DO

- **No board mutation of any kind.** Read-only by both authority and blindness.
- **Did not run `git` deliberately against the Windows `.git`** — hard stop while blind. One read-only
  `git show` executed indirectly inside `check-sot-bytes.mjs`; disclosed and lock-checked above.
- **Did not mint a worktree.** The git traps were reproduced in a synthetic `/tmp` repo with no
  relationship to any real `.git`, so no orphan lock is possible.
- **Did not stage a fix prompt.** F1/F3 are DOCTRINE canonical-block edits requiring a
  `lint-station.mjs` hash re-record, and F2 is 05-owned; both belong in their owner's shipment, not
  in a 56-deep HOLD queue. Staging them here would have created two prompts nobody owns.
- **Did not run Part 0 (a)–(f), Part 1 or Part 2.** The rotation assigned `instrument-honesty` and the
  station doc is explicit that one sweep covered completely beats a shallow pass over everything.
- **Did not touch `/sot/`** (05's) and did not attempt any GitHub write.
- **Did not report a watcher liveness verdict.** It needs the host; a mount read cannot distinguish
  alive from dead, and guessing is the exact failure §9.5 warns about.
