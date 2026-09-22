# Station 04 — Scanner | 2026-09-22T06:10:45Z–2026-09-22T06:22:57Z

## GROUND

```
UTC            2026-09-22T06:10:45Z
origin/main    447bff3b            (fetched, then rev-parse; unchanged at 06:22:57Z)
dev tree       main @ 447bff3b     C:\ProjectOperations2
doc version    1
bootstrap      1
```

Doc version and bootstrap **agree**. Full authority, not read-only.

Sweep this run: **`gate-liveness`** (rotation position 1 of 4), chosen by
`node scripts/pipeline/next-sweep.mjs`, not by me. Previous run `2026-09-22T02:10:31Z`.

## WHAT I MEASURED

**Reachability — SIGHTED.** [MEASURED] Desktop Commander loaded via `ToolSearch`, then
`start_process` shell `powershell.exe` → PID 22288, live, `USER=Marco`, all three binding documents
`Test-Path` **True**. This was a sighted run; nothing here is a blind run's coverage.

**The three binding documents were read in full, and verified against `origin/main` rather than
trusted from the working copy.** [MEASURED] `git --no-optional-locks diff --numstat origin/main --
<path>` returned EMPTY for all three (the sound form — §9.1 forbids comparing a piped hash):
`SAME-AS-ORIGIN: docs/pipeline/stations/04-scanner.md` · `…/DOCTRINE.md` ·
`…/STATION-CAPABILITIES.md`. The dev tree is `main @ 447bff3b == origin/main`, so working copy and
ref are the same bytes this run.

**vm-git-guard — the installer's last line, quoted, as PREFLIGHT requires.** [MEASURED]
2026-09-22T06:16Z, `bash "$HOME/mnt/ProjectOperations2/scripts/pipeline/vm-git-guard.sh"`:

```
To get the protection for one call, put the shim on PATH yourself:
   PATH="<session>/.local/bin:$PATH" git <args>
```

exit **2**, under the headline `vm-git-guard INSTALLED BUT INERT - the shim is correct and
UNREACHABLE from your shell.` Controls in the same call: `bash -lc 'command -v git'` →
`<session>/.local/bin/git`; `bash -c 'command -v git'` → `/usr/bin/git`; the shim exists on disk,
1149 bytes. **I ran no `git` through the bridge at any point this run** — every `git` and `gh` call
below went through PowerShell on the Windows host.

**PREFLIGHT step 4 — `status-sweep.ps1`, and its verdict is REAL.** [MEASURED] captured with `*>`
and decoded `utf16le` (§9.3 — the raw capture is 152,222 bytes opening `FF FE`, 435 lines; read as
UTF-8 it is structureless). Section 0 controls: `gh CAN reach GitHub (saw merged PR #2072)` and
`node runs` — **no `[BROKEN]`**. Section 3: `index.lock interactive/clone: False / False`, `git
processes touching our trees (scoped): 0`, `no PR touched on GitHub in the last 2 min`. Section 7:
**`SAFE TO ACT`**. Section 4: `armed (*-ready.md): 0`. No lock existed, so there was no stale-lock
age/size question to settle.

**`main` is green, re-derived from its own source rather than read off the sweep**
(§9.5 `SWEEP_LIVE_LINES_ARE_NOT_EXEMPT_V1`): the sweep's own line reads
`main CI on 447bff3b: 4 success / 0 failed (trunk green)`, and the one open PR **#2071** is
`BLOCKED`, `12 pass / 3 fail` — Station 00's to drive, not mine.

---

### The sweep: `gate-liveness`, covered completely

**Corpus.** [MEASURED] `docs/pr-prompts` depth 1: **HOLD=15, ready=0, LOOPING=0** (`rev-*`
excluded). `git` and `gh` both resolve on this box —
`C:\Program Files\Git\cmd\git.exe`, `C:\Program Files\GitHub CLI\gh.exe` — so §9.5's *"a missing
`git` makes every gate skip, and a skipped gate reads as an ADMIT"* is not in play.

**Instrument 1 — `triage-holds.ps1`, exit 0.** Both of its own positive controls PASS in the same
output: `GIT control: PASS -- git read origin/main:docs/pipeline/DOCTRINE.md (214264 chars)` and
`SPENT control: PASS -- lint-prompt.mjs emitted exit 3 on the fixture`. Result:
`spent=0  gates-satisfied=0  still-gated=15  unreadable=0`, and its direct re-probe of the 15
REJECTs found `0 spent behind a REJECT, 15 still needed, 0 UNMEASURABLE`. The 15 are **not** one
verdict: **11 `[HUMAN_GATE_PRESENT]`** and **4 `[FILE_GATE_NOT_RELEASED]`**.

**Instrument 2 — my own evaluation of every gate and every premise against `origin/main`
`447bff3b`**, written in node with `execFileSync` so no PowerShell pipe re-encodes anything (§9.1),
controls first: blob-read of a known-present path → true, of a needle path minted this run → false;
a grep hit and a grep miss over the same file; `gh pr view 2072 --json number,state,mergedAt` →
`MERGED`, and `999997` → a loud GraphQL error rather than a fabricated row (§9.4's `--json number`
trap avoided by asking for a field the server must supply).

| gate class | result |
|---|---|
| `requires_file_on_main` × 7 | **7 of 7 HELD** — every gated path is absent from `origin/main` |
| `requires_merged` × 2 | `#1361` **MERGED** 2026-08-28T01:15:21Z · `#1317` **MERGED** 2026-08-25T21:50:28Z — both correctly released |
| `requires_on_main` × 4 | `QUEUE-LAYOUT.md :: QUEUE_LAYOUT_V1` **MATCH**; `backfill-waste-map-location-ids.mjs :: NO MATCH` **MATCH**; two `pr-tipid-s3` targets **FILE_ABSENT**, correctly holding |
| premises × 15 | **15 ALIVE, 0 dead.** No finished work is sitting on the board. |

**The two instruments agree, and a third, independent source predicts the split exactly.**
`docs/approvals/README.md` — the file the sweep brief names — states that of the five
approval-gated prompts, three (`pr-524-rates-b-slice2-canonical`, `pr-retire-tenderclientnote-s2`,
`pr-siteid-notnull-backfill`) also carry a body human-gate and therefore reject
`[HUMAN_GATE_PRESENT]`, while *"the other two reject on the approval gate alone"*. [MEASURED]
`pr-rates-s11c-drop-legacy-tables` and `pr-tenant-mt4-s2-ownership-migration` are exactly the two
that reject `[FILE_GATE_NOT_RELEASED]`. **5 of 5 predicted.** That is a far better positive control
for this sweep than any absence-of-warning could be.

**So the brief's standing trap did not fire, and I repaired nothing.** For those two prompts the
approval-file gate IS the only thing lint rejects on — the class the brief warns about, where
"repairing" a gate would silently remove the protection. Both are irreversible schema/production
work. `docs/approvals/` on `origin/main` holds exactly two files (`README.md`,
`watcher-identity-approved-by-marco.md`); none of the five approval markers exists. **These gates
are alive and doing their job. Nothing was repaired, and nothing should be.**

**Queue-census delta, checked rather than assumed.** Station 00's 01:35Z run measured `HOLD=16`; I
measure 15. [MEASURED] the one that left is `pr-scopecards-s6-one-cutting-surface-HOLD.md`, and it
is accounted for, not lost: `.arming-log.txt` carries
`2026-09-22T02:13:25Z  ARMED  pr-scopecards-s6-one-cutting-surface  escalates=true
actor=station-00.interactive-0004`, and the §10.1 step-1 probe over `processed\pr-*.log` returns its
own consumed log for **PR #2071** (NEGATIVE control `PR #999995` → **0**). Armed → built → consumed,
correctly.

**Recurrence, already filed, not re-filed here.** `triage-holds.ps1` again printed
`!!! SUSPECT: every prompt landed in ONE bucket. That is the signature of a broken probe, not of a
uniform board.` three lines after both its own controls PASSED. [MEASURED] the condition is
`if ($buckets -lt 2)` and consults neither control. Station 00 filed this at 01:35Z today as F3,
marker `TRIAGE_SUSPECT_WARNING_FIRES_ON_A_LEGITIMATE_UNIFORM_RESULT_V1`, **DEFERRED**, calling it
the third consecutive reproduction. **This run is the fourth.** 00's stated urgency condition —
*"the warning firing on a run that DOES have gate-satisfied candidates"* — is still **not** met:
`gates-satisfied=0` again, so there was nothing to decline. Recorded as a count for 00's deferral,
deliberately not re-filed as a new finding.

**A negative reading I did not file, because §9.6 caught it.** `gate-eval.mjs` contains **0**
occurrences of any `requires_*` key, which reads as *"the shared evaluator does not implement the
dependency gates"*. Reading the file's own header shows it evaluates the four **executable**
registers (prompt `premise`, BACKLOG `gate`, ESCALATIONS `resolved_when`, LESSONS `regressed_when`);
the `requires_*` keys live in `lint-prompt.mjs` and `scripts/pr-watcher/index.mjs`, where
[MEASURED] `git grep -l requires_file_on_main` finds them. **My query was asking the wrong file.**
No finding.

**Negative control minted this run:** `zq04Nx20260922T0625` → **0 files** across
`docs/pr-prompts/**` and the station docs. It is now written down and is spent.

## WHAT CHANGED

1. `docs/pipeline/sweep-rotation.json` — **advanced**, as the station doc requires:
   `node scripts/pipeline/next-sweep.mjs --advance --utc 2026-09-22T06:10:45Z`, exit 0,
   `advanced: last_index=0 last_run_utc=2026-09-22T06:10:45Z`. **Read back:**
   `git diff --numstat origin/main -- docs/pipeline/sweep-rotation.json` → `2  2`. It is **LEFT
   DIRTY in the dev tree and named here — Station 00 commits it, because Station 04 may not.**
2. `docs/pr-prompts/pr-preflight-guard-claim-outlives-its-own-fix-HOLD.md` — **staged, untracked**
   (F1's fix). **Read back:** `node scripts/pipeline/lint-prompt.mjs <file>` → **`ADMIT (size 9)`,
   exit 0**. It is a `-HOLD`; **I armed nothing, renamed nothing, moved nothing and merged nothing.**
3. This breadcrumb, untracked at a tracked path.

Scratch files were written to `C:\po-sup-fix-scripts\` only. Nothing else in the dev tree was
touched; the three other untracked entries under `docs/pr-prompts/` (`.queue-sync-ledger.txt`,
`queue-watch-state.md`) predate this run.

## FINDINGS

### F1 — #2065 made the guard honest four hours ago and moved no document, so all seven station docs still promise a mechanical git ban that does not exist

`PREFLIGHT_GUARD_CLAIM_OUTLIVED_ITS_OWN_FIX_V1`

The `station-contract v3` canonical block tells every station that `vm-git-guard.sh` *"is
idempotent, it **persists itself onto `PATH`**"*, and classifies a bad outcome as *"a failed
install"*. [MEASURED] 2026-09-22T06:16Z the guard instead exits **2** under the headline
`INSTALLED BUT INERT`, and states in as many words: `THE DEVICE-BRIDGE GIT BAN IS NOT MECHANICAL IN
THIS SHELL. It is back to being remembered - which DOCTRINE 9.2 records as having failed seven
times.`

[MEASURED] `gh pr view 2065 --json files`: **PR #2065 touched exactly one file**,
`scripts/pipeline/vm-git-guard.sh`, merged `2026-09-22T02:58:44Z`. [MEASURED]
`git grep -c "persists itself onto" origin/main` → **1 in each of the seven station docs**
(`00-supervisor` … `06-pr-master`), plus one archived 09-21 breadcrumb and one superseded prompt,
both of which pre-date the fix. **No breadcrumb has reported the documentation half since #2065
merged** (NEGATIVE control, the needle minted this run → 0).

**Three separable defects in one sentence-pair, and each fails toward action rather than caution:**

- **(a) The claim is true only of a login shell.** A station's shell is non-interactive and
  non-login, reads neither `~/.bashrc` nor `~/.profile`, and resolves `/usr/bin/git`. The block's
  very next sentence — *"Without it, a cut-short call against the mount leaves a 0-byte
  `index.lock` … it freezes every station"* — is what makes believing the claim expensive.
- **(b) The vocabulary has no bucket for what the guard now says.** The block knows
  install-passed and *"a failed install"*. Exit 2 is neither: the install succeeded and the guard's
  own headline says `INSTALLED`. A station matching the block's words against the tool's output
  reaches no verdict at all — §7's shape, a well-formed reading with nowhere to go.
- **(c) The one-call cure the guard prints is absent from the block.**
  `PATH="…/.local/bin:$PATH" git <args>` is the only protection available inside a station's own
  shell, and a station has to read it out of stderr rather than out of its binding instructions.

**Blast radius: seven station docs, every scheduled run, every day.** The block is byte-identical
across all seven by design and hash-gated by `lint-station.mjs`, so the fix is one edit applied
seven times plus a re-recorded hash in `docs/pipeline/stations/_canonical-blocks.json` — which is
also why it cannot be shipped piecemeal.

**RULE 1 applied.** The complete-and-additive option is (1) **state all three outcomes and carry the
one-call cure in the block**: it fixes the present reading, it cannot rot the next time the guard's
behaviour changes because it describes states rather than a promise, and it removes nothing — the
ban itself, and the rule never to run `git` against a mount, are untouched. (2) *Delete the
"persists itself onto PATH" clause and say no more* is immediate but not future-proof: it fixes (a)
and leaves (b) and (c), so the next run meeting exit 2 still has no instruction. (3) *Change nothing
and let each run re-derive it* fails both halves — it is the failure mode DOCTRINE §9.5 records for
a claim that outlives its own truth in a document every station is told it can trust.

**DISPOSITION: DISPATCHED to Station 00.** The fix is staged, lint-clean and ready as
`docs/pr-prompts/pr-preflight-guard-claim-outlives-its-own-fix-HOLD.md` (`ADMIT`, size 9). Station 04
is read-only on the board and may not create the PR or arm the prompt; the file is untracked until
00's next board PR commits it, and **arming it is 00's decision on Marco's authority, not mine.**

## WHAT I DID NOT DO

- **Armed, disarmed, renamed, moved or deleted nothing.** `armed: 0` before and after.
- **Merged nothing and opened no PR.** #2071 is the only open PR, it is RED (`12 pass / 3 fail`),
  and it is Station 00's lane — I did not touch it, retrigger it, or read a verdict into it.
- **Repaired no gate.** All 22 gates measured are correctly held or correctly released. The two
  prompts whose approval-file gate is their *only* lint rejection are exactly the class the sweep
  brief says to report and leave alone; both are irreversible work.
- **Did not re-file the `triage-holds.ps1` SUSPECT banner** as a new finding. 00 filed it today and
  DEFERRED it with a stated urgency condition that this run does not meet; I recorded the recurrence
  count instead, which is the part that is new.
- **Did not commit `sweep-rotation.json`.** The dev tree is on `main`; 04 has *Create a PR: NO* and
  *Mutate the board: NO, read-only* in the §5 authority matrix. It is dirty and named above.
- **Ran no `git` through the device bridge**, guard inert or not — the guard being unavailable is
  never licence to run it.
- **Touched no Azure, Entra or SharePoint surface**, and wrote no production data.
- **Did not take the other three sweeps.** `instrument-honesty`, `repo-hygiene` and
  `instruction-drift` rotate; taking one completely is the rule, and the rotation is advanced so the
  next run does not repeat `gate-liveness`.
- **Did not run PART 2 (live-site) or the Dependabot pass.** The rotation named `gate-liveness` and
  covering it completely, plus the F1 evidence chain, consumed the run's budget. Not a blocker —
  `[CANNOT MEASURE]` is not claimed for them; they were deliberately not attempted.
