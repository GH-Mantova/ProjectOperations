# Station 00 — Supervisor | 2026-09-10T08:08Z–2026-09-10T09:0xZ

## GROUND

```
UTC            2026-09-10T08:08:07Z
origin/main    f4053f6d            (git fetch origin --prune, then git rev-parse --short)
dev tree       main @ f4053f6d     C:\ProjectOperations2   (0 behind, 0 ahead)
doc version    1                   (docs/pipeline/stations/00-supervisor.md front matter)
bootstrap      1                   (scheduled-task SKILL.md, station_doc_version: 1)
```

Doc version and bootstrap AGREE — this run was not read-only.

**SIGHTED run.** `ToolSearch` loaded the Desktop Commander schemas before any device call; the
keyword search was used rather than hard-coded ids, because the ids are environment-specific.
`start_process` shell `powershell.exe` then returned a live prompt on the first attempt
(`2026-09-10T08:08:54Z`). A validation error would have been an unloaded schema, not an unreachable
machine — the load came first and the call succeeded. This is not being reported as a quiet run.

**vm-git-guard: [CANNOT MEASURE], seventh consecutive run.** PREFLIGHT step 1 asks for
`bash "$HOME/mnt/ProjectOperations2/scripts/pipeline/vm-git-guard.sh"`. Two attempts, both refused
before the script was reached. Last line, verbatim: `bash failed on resume, create, and re-resume.
resume: RPC error -1: failed to mount … under Plan9 share "c" which is not mounted; create: RPC
error -1: ensure user: user brave-exciting-hypatia already exists unexpectedly`. A failed install is
a FINDING, not a STOP. Blast radius is nil by construction: with no VM there is no VM-side `git` to
guard, and none was run — every probe below went through Desktop Commander against the Windows host.

**Read from the working copy, proved sound rather than assumed.**
`git diff --numstat origin/main -- docs/pipeline/stations/00-supervisor.md docs/pipeline/DOCTRINE.md
docs/pipeline/STATION-CAPABILITIES.md` → **EMPTY** for all three, so the working copy holds
`origin/main`'s blobs. No piped `hash-object` comparison was made (§9.1 — unsound in
`powershell.exe`). All three read in full: 1299, 1846 and 485 lines.

**Fresh needle minted this run, now SPENT by appearing here:** `zzQq00N20260910T0812y`.

## WHAT I MEASURED

**Sweep — SAFE TO ACT, twice.** `status-sweep.ps1` captured to a file, because it returns early and
hides its own section 7 verdict otherwise. 08:13:24Z and again at **08:53:12Z**, immediately before
the board mutation: `index.lock` interactive/clone **False / False**, `git processes running: 0`,
`no PR touched on GitHub in the last 2 min`, verdict **SAFE TO ACT** both times.

**Board — 2 open, both CLEAN, both 15/15 green, both Marco's.** `#1832` (vm-git-guard self-test) and
`#1823` (EA-GATE reporting.team permission). `main` CI on `f4053f6d`: **4 success / 0 failed**.
Armed `*-ready.md`: **0**, counted by hand. There is no red anywhere on this board.

**RULE 2 — re-verified live this run, not inherited from my predecessor's breadcrumb** (§7.1's
re-read rule). Probe pinned to `C:\ProjectOperations2\docs\pr-prompts\processed` and never the
clone: **2108** logs, newest **2026-09-10T07:29:32Z** — more recent than both PRs' `createdAt`,
which is the control that separates the live directory from the seventeen-day-stale decoy.
POSITIVE `marco.:true` → **627**; NEGATIVE (needle minted this run) → **0**; NEGATIVE `PR #999999`
→ **0**. Matched on `PR #<n>` in the body of `pr-*.log`, which excludes the `rev-*` review jobs:

- `#1832` → `{"ok":false,"marco":true,"reason":"outside tests/ or docs/: scripts/pipeline/vm-git-guard.sh"}`
- `#1823` → `{"ok":false,"marco":true,"reason":"escalates:true - held for Marco, labelled do-not-merge"}`

Both reasons are **specific**, so neither is the byte-identical timeout path §10.3 warns reads the
same as a real routing. **RULE 2 binds on both and I merged neither.** An absent label does not
clear it.

**Queue — 42 HOLDs, 11 gate-satisfied, 0 spent.** `triage-holds.ps1` exit 0 with both of its own
controls passing (`GIT control: PASS`, `SPENT control: PASS`):
`spent=0 of 42 evaluated  gates-satisfied=11  still-gated=31  unreadable=0`.

**Station cadences, crossed against `lastRunAt` from the scheduled-tasks MCP** — not from
`--freshness` alone, which compares breadcrumb dates and cannot name a cause:

| station | newest breadcrumb | `lastRunAt` | reading |
|---|---|---|---|
| 00 | 2026-09-10T07:08Z | 08:08:07Z (this run) | aligned |
| 03 | 2026-09-09T23:01Z | 2026-09-09T23:01:42Z | aligned, next 23:00Z |
| 04 | 2026-09-10T06:10Z | 2026-09-10T06:09:45Z | aligned, next 10:09Z |
| 05 | 2026-09-09T22:02Z | 2026-09-09T22:01:58Z | aligned, next 14:10Z |

`check-breadcrumb.mjs --freshness` → **CLEAN**, exit 0, all stations `ok`, `structure: 9 checked,
0 malformed`. It still prints `00 … (cadence 2h)` against a live cron of `5 * * * *`; that is the
known `const CADENCE` defect, already on file, and it is why the MCP cross-check above is the
load-bearing instrument and not the `ok`.

**Watcher — running and stable across two hours.** node RUNNING **pid 18228** — the same pid the
06:08Z and 07:08Z runs recorded, so the silent death the 06:08Z run reported has not recurred.
Auto-restart wrapper alive (1). Clone `branch=main dirty=0`. Heartbeat 44 min then 84 min, which is
the correct idle reading with `armed: 0`, since the heartbeat ticks only mid-run.

**Collect corpus.** No station wrote to the queue root between my predecessor's 07:08Z collect and
this run — 04 is next at 10:09Z, 03 at 23:00Z, 05 at 14:10Z. All 9 root breadcrumbs are tracked on
`origin/main`, and `git ls-files docs/pr-prompts` (961 tracked files) shows **archiveDup=0** for
every one, so this archive creates no duplicate basename. My collect is therefore the 07:08Z
breadcrumb itself, whose one handed-forward action I discharged (see below).

## WHAT CHANGED

1. **Two new bullets in DOCTRINE §9.3**, both measured in this run — the CRLF front-matter parser
   trap (F1) and the `*>` UTF-16LE capture trap (F2). Edited with node by **concatenation**, never a
   `String.replace` replacement string, and the **byte delta was asserted**: expected 2890, actual
   2890, MATCH. Anchor still present exactly once; new bullet present exactly once.
2. **Canonical block re-recorded** — `lint-station.mjs --write-canonical`, new hash
   `instruments v2 b5ba4ccb16425b6c`. Before the re-record `lint-station.mjs` read
   `REJECT: 1 of 8 docs failed`, which is the expected DOCTRINE-only shape for an `instruments v2`
   edit; after it, **`ADMIT: all 8 docs clean`, exit 0**.
3. **Eight collected breadcrumbs archived** into `docs/pr-prompts/archive/` — the seven 00 runs from
   00:08Z to 06:08Z and Station 04's 06:10Z. All eight staged as **R100** (pure renames, no content
   change). The 07:08Z breadcrumb stays in the root as the current cycle.
4. **This breadcrumb**, written inside this run's own PR worktree (cure 1 of the delete-the-disk-copy
   rule), so no loose copy is left in the dev tree to block the next fast-forward.
5. **Nothing merged. Nothing armed. No label added or removed. No `sot/` edit. No production data.
   No Azure / Entra / SharePoint. No `git` run in `C:\po-watcher\ProjectOperations`** — reads only.
   All work was done in a disposable worktree off `origin/main` at `C:\po-wt\st00-0808`.

## FINDINGS

### F1 — The lane-eligibility probe answered "0 of 11" with a parser that had parsed nothing, and that is the same number six runs before it reported

This is the finding of the run, and I walked into it myself.

F4 of the last six Station 00 breadcrumbs states that no gate-satisfied HOLD can enter the
`tests-docs` lane, and names its own falsifying probe: re-run the classification. I re-ran it. The
first result was **`scope=0` on all eleven prompts** and a headline of `TESTS-DOCS ELIGIBLE = 0 of
11` — the same number as every previous run.

**A uniform zero across a heterogeneous input set is the signature §9.4 names**, and it is the only
reason I looked again. The eleven prompts range from a one-line `scope:` to an eight-entry one; they
cannot honestly all be zero.

| probe | reading |
|---|---|
| `/^scope:\s*\n((?:\s*-\s*.+\n)+)/m` on `pr-triage-corpus-suffix-union-HOLD.md` | **no match** |
| `/^scope:[ \t]*\r?\n((?:[ \t]*-[ \t]*\S.*\r?\n)+)/m`, same bytes | **match** |
| raw bytes at `scope:` | `"scope:\r\n  - scripts/pipeline/triage-holds.ps1\r\n"` |

The prompts are stored **CRLF**. Re-run with the working parser, all eleven parse — scope counts
`8 6 4 2 5 6 3 6 4 1 1` — and the classification is **still 0 of 11**: three refused on the
`migrations/` clause, eight outside `tests|docs`.

**So the conclusion was right and the evidence for it was worthless**, which is the more dangerous
half. Had the corpus contained one lane-eligible prompt, the broken parser would have hidden it and
the report would have looked exactly like the six before it.

**The controls did not catch it, and the reason generalises.** Three controls ran and all three
passed — POSITIVE paths true, NEGATIVE paths false, migration clause true. Every one of them tests
the **classifier**, and none of them tests the **parser that feeds it**. A classifier controlled
only on synthetic paths it never actually receives is a check nobody has seen fail.

**DISPOSITION: ACTIONED.** The parser is fixed, a PARSER POSITIVE/NEGATIVE control is added
alongside the classifier controls, the eleven were re-classified on the sound instrument, and the
durable rule — *control the extraction step separately from the decision step* — is landed in
DOCTRINE §9.3 in this run's PR with its falsifying probe attached. The corrected verdict table is
under WHAT I MEASURED above and is what F3 below now rests on.

### F2 — The station contract tells every run to capture the sweep to a file, and that capture is UTF-16LE

PREFLIGHT step 4 says to run `status-sweep.ps1` and obey it; the standing method note adds that it
returns early and hides its own section 7 verdict, so **capture it to a FILE**. I did:
`status-sweep.ps1 *> sweep.txt`.

[MEASURED] the result was **129,564 bytes opening `FF FE`**. Read back with
`readFileSync(p, "utf8")` it split into 380 lines whose `====` section headers matched **no** regex
— a fully structured ten-section report reading as structureless, at exit 0, with nothing empty and
nothing warning. Re-decoded as `utf16le`, all ten sections were present.

§9.3 already records that `>` writes UTF-16LE in PS 5.1, but it names the form
`git show <ref>:<path> > file`. The all-streams form `*>` is the same trap, and it is the form the
sweep-capture cure naturally reaches for — **the prescribed cure for one trap is a direct instance
of another**, which is the composition shape §9 keeps recording.

**DISPOSITION: ACTIONED** — landed in DOCTRINE §9.3 as a bullet immediately above the existing `>`
bullet it extends, naming the measurement and the cure (decode `utf16le`, or write the capture from
node).

### F3 — Nothing on this board can move without Marco, and this is the SEVENTH consecutive run to measure it — but the first on a sound instrument

Both open PRs carry live, **specific** watcher `marco:true` verdicts. All eleven gate-satisfied
HOLDs classify outside `tests|docs` — three on the migrations clause alone. `needs-marco/` holds
**54** files. There is no red to fix: `main` is green and both PRs are 15/15.

The constraint is not the machinery. The sweep is clean, the watcher is up and has held one pid for
two hours, the linter is honest, the queue is triaged, and every remaining path forward terminates
in a human decision. Arming faster lengthens the queue Marco is already the constraint on.

**What is new this run is only the epistemic status of the claim.** Six runs asserted it from a
parser that returned zero unconditionally (F1). It is now measured.

**DISPOSITION: DEFERRED** — real, measured, and already carried by three separate escalations: the
RULE 2 clearance that lives in a chat no scheduled run can read, the `tests-docs` lane starvation,
and the vacuously-passing CP-26 gate. I am deliberately not filing a fourth that would restate them.
**What would make it urgent:** a gate-satisfied HOLD appearing that *is* `tests|docs`-only, which
would prove the lane can still be fed. That is cheap to re-test — it is the classification table
under WHAT I MEASURED, re-run **with the fixed parser and its control**.

### F4 — The Cowork Linux workspace failed for the seventh consecutive station run

`Plan9 share "c" which is not mounted`, plus `ensure user … already exists unexpectedly` — identical
in shape to the failures the last three Station 00 runs and Station 04's 06:10Z run recorded, and
different from the 05:08Z run's `SDK version 2.1.260 not verified`, so at least two distinct causes
have produced this outcome. That matters because a single-cause fix will not clear it.

Already on file as `needs-marco/cowork-vm-mount-unreachable-two-stations-2026-09-10.md`.

**DISPOSITION: DEFERRED** — not re-raised; the count is updated here rather than in a second
escalation file. The guard it blocks protects against a VM-side `git` call reaching the Windows
`.git`; with no VM there is no such call, and none was made. **What would make it urgent:** a run
where the workspace *does* start — that run must install the guard before its first mount-side call
and must not read this note as cover for skipping it.

### F5 — My predecessor's one handed-forward action is discharged

The 07:08Z run committed two spent `-LOOPING.md` prompts into `docs/pr-prompts/superseded/` and
deferred the disk-copy deletion until after its PR merged, listing the read-backs it owed.
`#1843` merged at 07:31Z. [MEASURED] this run: `git status --porcelain` in the dev tree shows **no
`-LOOPING.md` at the queue root and no modified tracked file**, `git rev-list --left-right --count
HEAD...origin/main` → **`0 0`**, and a by-hand count of `*-LOOPING.md` at depth 1 → **0**.

**DISPOSITION: ACTIONED** — closed, verified, nothing outstanding. Recorded because a deferred
read-back that nobody confirms is how a half-finished cure gets re-derived from first principles,
which the delete-the-disk-copy section says has already cost four runs.

## WHAT I DID NOT DO

- **Did not merge anything.** Both open PRs carry a live, specific watcher `marco:true` verdict.
  RULE 2 binds and is not cleared by green, by CLEAN, by an absent label, or by a receipt.
- **Did not add or remove a label** on either PR. Only Marco removes `do-not-merge`.
- **Did not arm anything.** `armed: 0` at the start and at the end. All eleven gate-satisfied HOLDs
  route to Marco, now measured on a working parser rather than a broken one.
- **Did not author a merge-approval receipt.** A scheduled run never may, whatever the supervised
  cloud lane's standing authority permits.
- **Did not archive the 07:08Z breadcrumb.** It is the current cycle; archive is for what has already
  been dispositioned by a *later* run.
- **Did not commit the untracked paths** in the dev tree — `Claude Design/docs/index.html`,
  `docs/pr-prompts/.queue-sync-ledger.txt`, `queue-watch-state.md`,
  `archive/review-escalations-516-1346/`, `docs/pr-reviews/pr-1827-review.md` and
  `pr-1834-review.md`. None is a hand-off addressed to this run, and the two review files are
  review-lane output whose home is contested by §9.5's three-homes rule — adopting them into a
  collect PR would assert a provenance I have not established.
- **Did not touch `C:\po-vg`** (1 uncommitted file, 8660 min old) or `C:\po-worktrees\pr1823` (its
  PR is still open). Worktree hygiene is Station 03's lane and `po-vg` is already escalated.
- **Did not run `git` in `C:\po-watcher\ProjectOperations`** beyond reads, and did not touch the
  stash. Dropping entries is Station 03's.
- **Did not touch `/sot/`** (Station 05's), Azure / Entra / SharePoint (absolute), or production data.
- **Did not run the four non-rotation sweeps.** Station 04 owns the sweep rotation; this is a collect
  run, and 04 is next at 10:09Z.
- **Did not delete the dev tree's disk copy of anything this PR archives.** The eight archived
  breadcrumbs move inside the worktree; the dev tree's tracked copies at the root path are removed by
  the fast-forward itself, so the untracked-copy trap does not arise here. After the merge the dev
  tree is fast-forwarded and read back three ways — `git rev-list --left-right --count
  HEAD...origin/main` → `0 0`, `git diff --numstat` → EMPTY, `git diff --cached --name-status` →
  EMPTY. Never `git clean`, never `git checkout .`.
