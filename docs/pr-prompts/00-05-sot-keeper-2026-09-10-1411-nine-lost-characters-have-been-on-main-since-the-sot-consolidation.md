# Station 05 — SoT Keeper | 2026-09-10T14:11Z–2026-09-10T14:52Z

## GROUND

```
UTC            2026-09-10T14:11:14Z
origin/main    58a947fe  (advanced to cfbf59d6 mid-run; worktree cut from cfbf59d6)
dev tree       main @ 58a947fe   C:\ProjectOperations2
doc version    1
bootstrap      1
```

Doc version and bootstrap AGREE — this run was not read-only.

Sighted run. `start_process` (shell `powershell.exe`) succeeded on the first call after
`ToolSearch` loaded the Desktop Commander schemas. Not blind.

No missed occurrence to catch up. `check-breadcrumb.mjs --freshness --station 05` reports
`last 2026-09-09T22:02:00Z, 16.2h ago` — inside this station's own one-cadence threshold of ~24 h,
so no day is owed.

## WHAT I MEASURED

**Binding documents.** All three read in full this run, from the dev tree, after proving the dev
tree was identical to `origin/main`: `git diff --numstat origin/main -- docs/pipeline/DOCTRINE.md
docs/pipeline/STATION-CAPABILITIES.md docs/pipeline/stations/05-sot-keeper.md` returned EMPTY, which
is the real answer per the preflight block. `[MEASURED]`

**Device-bridge git guard — COULD NOT INSTALL.** `bash .../scripts/pipeline/vm-git-guard.sh` failed
twice with an identical VM error, quoted verbatim: `failed to mount ... under Plan9 share "c" which
is not mounted`. The Linux sandbox is unavailable for this whole session, so the installer's last
line does not exist to quote. `[CANNOT MEASURE]` — see F3. Per the contract a failed install is a
finding, not a stop, and the hazard it guards cannot arise this run because no VM-side call is
possible at all.

**Preflight sweep, run twice.** First run `SWEEP-EXIT=10`, section 7 `DO NOT ACT: a board mutation
is in progress`. Cross-checked as the contract requires rather than obeyed on sight:
`Get-CimInstance Win32_Process -Filter "Name='git.exe'"` returned **zero** rows, and
`C:\ProjectOperations2\.git\index.lock` and `C:\po-watcher\ProjectOperations\.git\index.lock` both
`ABSENT`. The trigger was section 3's `git processes running: 2` — transient, and consistent with
the sweep's own git subprocesses. Re-run at 14:4xZ: `git processes running: 0`, both locks still
absent, verdict now `CAUTION: 1 LIVE STATION WORKTREE(s) detected — C:/po-wt/bc-00-1408`, whose
stated remedy is *use an ISOLATED worktree and touch only NEW branches/PRs*. That is exactly this
station's sanctioned delivery, and it is what this run did. `[MEASURED]`

**Audit 1 — schema parse sanity.** `node scripts/data-model/build-relationship-map.mjs --check` →
`OK: generator ran cleanly against schema.prisma (296 models, 69 enums, 493 edges)`, exit 0.
Independently re-parsed from `schema.prisma` in node: 296 models, 69 enums — agrees. `[MEASURED]`

**Audit 2 — catalog validity.** `docs/data-model/metadata-catalog.json` parses: 690,682 bytes,
4 top-level keys, exit 0. Not invalid. `[MEASURED]`

**Audit 3 — sot/04 drift: NONE, and by the sharpest available probe.** sot/04's generated section
records `Generated from: apps/api/prisma/schema.prisma (sha256 83ad3df361bd)`. Recomputed with the
generator's own algorithm (`createHash('sha256').update(text.replace(/\r\n/g,'\n'))`, anchors
`const normalized =` / `const schemaSha =`): working copy `83ad3df361bd`, `origin/main`
`83ad3df361bd`, sot/04 recorded `83ad3df361bd`. All three agree, so the generated section is
current and **no re-merge is needed**. Corroborated by counts: sot/04's TOC holds 23 domains
summing to **296** models and **296** `(#model-` links, against the generator's 296.
Last updated stamp `2026-09-09 22:47 UTC`. `[MEASURED]`

**Audit 4 — roadmap drift: PRESENT.** See F2.

**Audit 5 — automation health: GOOD. Nothing to lead with.** Watcher resolved by PID **and command
line**, never by image name: 18 `node.exe` running, exactly **1** matches `pr-watcher` +
`index\.mjs` — pid **18228**, started `2026-09-10T05:39:45Z`, cmdline
`...\node.exe --no-deprecation C:\po-watcher\ProjectOperations\scripts\pr-watcher\index.mjs`.
POSITIVE control 18, NEGATIVE control (a needle minted for this run) 0. Live task list read rather
than enumerated from any document: `PO Watcher Keepalive`, state `Ready`, `LastTaskResult` **0**,
last run `2026-09-11 00:15:02` local (= 14:15Z, one minute before the reading). Newest prompt log
under the dev tree's `docs/pr-prompts/processed/` (the LIVE probe directory, never the clone):
`rev-1853-ready.md.log` at `2026-09-10T13:29:04Z`, 2118 logs. Newest daily clone log, selected by
name shape then mtime rather than by a constructed date: `2026-09-10.log`, written
`2026-09-10T14:14:49Z` — one minute old. `[MEASURED]`

**Audit 6 — model ↔ migration coherence: CLEAN.** 296 models resolved against 245 `migration.sql`
files (630,071 bytes), honouring `@@map` physical names: **0** models with no backing migration
text. POSITIVE control (a known-old model found) `true`; NEGATIVE control (minted needle) `false`.
`[MEASURED]`

**Audit 7 — registry, report only.** 225 of 296 model names are not mentioned anywhere in
`sot/01-charter-and-architecture.md`. sot/01 carries a **module** registry, not a model list, so
this number is not by itself a defect and is recorded as a measurement, not a finding. `[MEASURED]`

**SOT-REFS BURN-DOWN — the list is EMPTY.** `node scripts/pipeline/check-sot-refs.mjs` →
`total=275 dangling=0 exempt=20 baselined=0 excluded=2`, exit 0, `All sot/ references resolve.`
`docs/qa/sot-refs-baseline.json` holds `entries.length=0` on disk **and** on `origin/main`. There is
no entry left to burn down. See F5. `[MEASURED]`

**RULE ZERO — local pass cross-checked against real CI, no ENVIRONMENT DISAGREEMENT.** Local
`--check` passes; the matching CI job `Data model — generator sanity (schema.prisma parses cleanly)`
reads **success** on `main` HEAD (full 40-char SHA `58a947fe3e544f1cf3505de23f85b1beda707eaa`, CI run
`34482718263`) **and** on all five open PRs. Main's other runs: `Push on main`, `CI`, `Deploy`,
`Tendering Browser Smoke` all `success`; `Claude Code` `skipped`. `Approval receipt (CP-26)` and
`PR gates — diff checks` read `skipped` on main, which is expected — both are pull_request-scoped.
`[MEASURED]`

**Board, and S7 one-and-done.** 5 open PRs at 14:2xZ — #1852, #1850, #1845, #1832, #1823, all
unlabelled. **None touches `sot/` or `docs/data-model/`** (`sot/=0` on all five), so no reconcile PR
was already pending and S7 permitted this run to open one. `#1854` opened during the run and merged
as `cfbf59d6`. `[MEASURED]`

⚠️ **Instrument note, recorded because it cost this run two probes.** `gh ... --json files,
statusCheckRollup` written **with a space after the comma** made all five PR reads fail identically
— `GH FAILED exit=1`, a uniform zero across a heterogeneous set, which is §9.6's signature. This is
DOCTRINE §9.4's documented cause (PowerShell splits the field list into separate arguments). Removing
the space fixed it. The run's `$LASTEXITCODE` test is what surfaced it rather than letting an empty
board be parsed as a real one. `[MEASURED]`

⚠️ **A negative control that did not discriminate, declared rather than buried.**
`gh pr view 999999 -R <repo> --json number` returned **exit 0, 17 chars** (`{"number":999999}`) — gh
echoes the requested number without validating it, so that control proves nothing. The PR-state
readings in F2 do not rest on it: they rest on two independent instruments agreeing —
`gh pr list --state open` returned exactly five PRs with #1823 present and #1824–#1827 absent, and
per-PR `gh pr view` returned four distinct real `mergedAt` timestamps and real titles matching
sot/02's own table. `[MEASURED]`

## WHAT CHANGED

**One doc-reconcile PR, opened from a disposable worktree at `C:\po-wt\sot05-fffd-20260910`, cut
from `origin/main` @ `cfbf59d6`, branch `fix/sot03-restore-nine-lost-characters`.** Station 05 did
not arm, did not merge, and did not commit on `main` in the dev tree. The dev tree index was
confirmed empty (`git diff --cached --name-status` → nothing) before the worktree was created, per
the shared-index rule.

1. **`sot/03-progress-log.md` — nine lost characters restored.** Six lines changed,
   `git diff --numstat` = `6	6	sot/03-progress-log.md` and nothing else. Byte delta asserted before
   the write and read back after it: 648,359 → 648,354 = **−5**, exactly the predicted
   `expected delta = -5`. U+FFFD count 9 → **0** on read-back. Edited in node by **concatenation**,
   never `String.replace` with a replacement string, per DOCTRINE §9.3.

2. **This breadcrumb**, committed inside the same PR — the contract's preferred home, so it needs
   nobody to sweep it up. `sot/` + `docs/` together is explicitly permitted by CP-24; `scripts/` and
   `apps/` are untouched.

## FINDINGS

### F1 — nine characters have been unreadable in `sot/03-progress-log.md` since the day the file was created, and no copy in git history is clean

`sot/03-progress-log.md` carried **9** U+FFFD replacement characters. This is not the false mojibake
DOCTRINE §9.3 warns about — the file was decoded strictly in node, not displayed through
`Get-Content`, and the detector was positively controlled against a synthetic double-encoded string.
The other six `sot/*.md` files are clean: 0 U+FFFD, 0 double-encoding signature, 0 BOM.

The damage is **committed**, not local: `git show origin/main:sot/03-progress-log.md` also counts 9.
It is confined to one entry, the 2026-05-26 record of PR #228, char range 375,673–376,571.

**There is no clean copy to restore from.** Every commit that has ever touched the file carries the
same 9 — including `14e14058 docs: consolidate source-of-truth into /sot/ (#511)`, the commit that
created it. The damage entered with the consolidation on 2026-07-08 and has been on `main` ever
since.

**The repair is therefore an evidence-backed restoration, not a guess.** The authoritative source is
PR #228's own body, which is undamaged (`gh pr view 228 --json body` → 2,346 bytes, U+FFFD count
**0**):

| line | damaged | restored | evidence |
|---|---|---|---|
| 7327 | `## 2026-05-26 ? feat/…` | `—` U+2014 | 409 of 410 dated `##` headings in this file use U+2014; the damaged one was the only outlier. Immediate neighbour L7299 reads `## 2026-05-26 — feat/tendering-delete-edit OPENED` |
| 7329 | `Type: Seed data (?5 Tendering)` | `§` U+00A7 | L7301, the entry directly above, reads `Type: Feature (§5 Tendering)`; `(§5 Tendering)` occurs twice more; `§` occurs 191 times in the file |
| 7331 | `Additive seed ? IS-T100` | `—` U+2014 | PR #228 body: *"Additive seed change — adds IS-T100"* |
| 7332 | `"TEMPLATE ? Full-Feature` | `—` U+2014 | PR #228 body: `"TEMPLATE — Full-Feature Reference Quote"` |
| 7333 | `DEM?4, CIV?3, ASB?4, Other?5` | `×` U+00D7 ×4 | PR #228 body lists **DEM (4), CIV (3), ASB (4), Other (5)** — the same four counts — and itself writes `2× provisional sums` |
| 7341 | `193 web tests ? all pass` | `—` U+2014 | file convention; L7324 four lines above reads `768 tests (9 new), web tests — all pass.` |

(The `?` in the left column is this document rendering U+FFFD; the real characters are in the diff.)

No semantic content was altered — only characters an encoding fault destroyed. Each needle included
its surrounding context and the script aborts if any needle matches other than exactly once.

⚠️ **Judgement call, declared plainly.** This station's auto-fix allowlist names only the generator
re-run and the sot/04 re-merge, and lists *"curated prose in sot/01/02/03/05/06"* as never-auto-fix.
I judged a character-level encoding restoration to fall outside "curated prose" because it changes
no meaning, is fixed by an authoritative external source rather than inferred, and is the same class
of repair DOCTRINE §9.3 records as already performed across five station docs on 2026-08-24. The
human gate is intact regardless: S1 delivery is a PR that **Marco reviews and this station cannot
merge**. If Marco disagrees, closing the PR costs nothing and the finding still stands on record.

**DISPOSITION: ACTIONED** — restored in this run's PR; verified by byte delta (−5, predicted and
actual identical), by U+FFFD read-back (0), and by `git diff --numstat` showing 6 changed lines in
one file and nothing else.

### F2 — sot/02's "In-PR — open right now (5)" table is 15 hours stale, and it is the second time the same table has rotted

`sot/02-roadmap-and-status.md` §2 (L61) is headed **"In-PR — open right now (5)"** and names #1823,
#1824, #1825, #1826, #1827. Live state at 14:3xZ:

| PR | sot/02 says | live | merged at |
|---|---|---|---|
| #1823 | In-PR | **OPEN** | — |
| #1824 | In-PR | **MERGED** | 2026-09-10T02:20:31Z |
| #1825 | In-PR | **MERGED** | 2026-09-09T23:13:23Z |
| #1826 | In-PR | **MERGED** | 2026-09-09T23:27:36Z |
| #1827 | In-PR | **MERGED** | 2026-09-10T00:00:44Z |

Four of five are merged, and four PRs opened since the snapshot (#1832, #1845, #1850, #1852) are
absent from it. The table does self-date — *"Live snapshot read from GitHub at reconcile time
(2026-09-09T23:03Z, `origin/main` f482d1a5)"* — but the **heading** says "open right now", and the
section's own note records that this exact table previously read "open right now (2)" from
2026-08-04 while naming two PRs that had merged that same day.

**So the shape is the finding, not this instance.** A hand-maintained board snapshot inside source
of truth rots within hours of being written, and has now done so twice. Refreshing it a third time
buys about one day, which fails the *future* half of RULE 1.

⚠️ Not repaired in this run. sot/02's status semantics are explicitly never-auto-edit, and the
options below differ in what the document is *for*, which is a judgement about Marco's own roadmap.

**Options, complete-and-additive first, per RULE 1:**

**(a) Delete the snapshot table and replace it with a pointer to the live instrument** — the section
already tells the reader *"run `scripts/pipeline/bring-up-to-speed.ps1` — its `[LIVE]` lines beat
this table the moment it drifts."* Passes both halves: it cannot rot again (future), it is correct
the moment it lands (immediate), and it destroys no data entry — the per-PR history the table
duplicates already lives in `03-progress-log.md`. **Cost:** a reader loses an at-a-glance list
without running a script.

**(b) Keep the table but demote the heading** from "In-PR — open right now (5)" to something that
reads as a dated snapshot, e.g. "In-PR — snapshot at &lt;date&gt;, verify live before use". Fails the
*future* half: it still rots, it just lies less confidently while doing so.

**(c) Keep it and refresh it each reconcile** — the status quo. Fails the *future* half outright;
this finding is the evidence.

**DISPOSITION: ESCALATED** — Marco's call, because it changes what sot/02 §2 is for. Station 05 will
implement whichever he picks on the next run, in a doc-reconcile PR.

### F3 — the Linux sandbox was unreachable for this entire session, so the device-bridge git guard could not be installed

`bash .../scripts/pipeline/vm-git-guard.sh` and a bare `ls` probe both failed identically, twice,
with `source path ... is under Plan9 share "c" which is not mounted` and
`ensure user: user amazing-clever-sagan already exists unexpectedly`. Two honest attempts, so no
further looping.

The guard exists to stop a VM-side `git` call leaving a 0-byte `index.lock` with no owning Windows
process (DOCTRINE §9.2). **That hazard cannot occur this run**, because the same failure that
blocked the install also makes every VM-side call impossible — the transport is down, not just the
script. No `git` was run against the mount, and both `index.lock` paths were verified absent at the
end of the run as well as the start. All work went through Desktop Commander, which is the only
sanctioned transport for the host.

⚠️ Worth noting for whoever reads this next: `STATION-CAPABILITIES.md` §3 records that a blind run
still retains its COLLECT through the `/sessions/<id>/mnt/` mounts. **This run had the inverse
shape** — the Windows host was reachable and the mounts were not. That combination is not described
anywhere in the three binding documents, and a run that assumed "no mount ⇒ blind" would have
stopped while holding a fully working shell.

**DISPOSITION: DEFERRED** — real, not now. It becomes urgent the moment a run needs the mount and
the host together, or if a later run finds a 0-byte `index.lock` with no Windows process. Not
dispatched to 03: the fault is in the Cowork session's VM, not on Marco's box, which is outside 03's
lane and outside this repo.

### F4 — #1823 has a genuinely failing check, and it is not mine to fix

`#1823` (`feat/ea-gate-reporting-team-permission`, open since 2026-09-09T00:05Z) carries
**1 failing check: `tendering-e2e`**. The other four open PRs have zero failing checks. #1823 is
unlabelled, touches 6 files, none under `sot/`.

This is application/test code — outside Station 05's lane in every direction. Not diagnosed here: I
did not pull the job log, and DOCTRINE §3 forbids diagnosing a CI failure without it, so this is
reported as an observation and not as a cause.

**DISPOSITION: DISPATCHED** — to Station 00, which drives the board and may read the job log and
fix or route it.

### F5 — the sot-refs burn-down is complete, and this station's doc has no instruction for an empty list

`docs/qa/sot-refs-baseline.json` now holds **zero** entries, on disk and on `origin/main`.
`check-sot-refs.mjs` reports `dangling=0 exempt=20 baselined=0`, exit 0.

This station's doc calls the burn-down *"your primary housekeeping obligation"* and gives a
six-step workflow that opens with *"pick an entry"*. There are no entries. The doc is not wrong —
it correctly refuses to state the count — but it does not say what the station should do once the
list is empty, so each future run will re-derive that there is nothing to pick.

The `may only shrink` ratchet is still valuable and must stay; what is missing is one line saying
the list is expected to be empty, that the obligation is now to keep it that way, and that a newly
dangling reference is fixed in `sot/` directly rather than added here — which the doc already says
elsewhere.

Not folded into this run's PR on purpose: safeguard S5 caps a reconcile PR's scope, and mixing an
instruction change into an `sot/` content repair makes the review harder for no gain.

**DISPOSITION: DISPATCHED** — to Station 00, as a one-line addition to
`docs/pipeline/stations/05-sot-keeper.md` in its own docs PR.

## WHAT I DID NOT DO

- **Did not re-merge sot/04's generated section, and did not run the generator in write mode.** The
  schema sha256 matches on all three sides, so there is nothing to re-merge. Safeguards S2, S3, S4
  and S6 govern that operation and were therefore not exercised this run — they are not reported as
  passed. The known side effect that regenerating **shrinks** tracked `metadata-catalog.json` did
  not arise, because nothing was regenerated.
- **Did not touch `sot/02`.** F2 is escalated, not actioned.
- **Did not delete or add any `sot-refs-baseline.json` entry.** There are none to delete, and adding
  one is forbidden.
- **Did not arm, did not merge, did not remove a label, did not stage a prompt.** Station 05 may do
  none of these. No `*-ready.md` was created; a breadcrumb filename matches no watcher glob.
- **Did not run `build-toc.mjs --check` against `sot/`** — no `sot/` file carries TOC markers, so it
  reports drift unconditionally.
- **Did not diagnose #1823's `tendering-e2e` failure** — no job log was read, so no cause is claimed.
- **Did not touch Azure, Entra or SharePoint**, and did not read or write production data.
- **Did not clear any lock.** None existed; had one existed, clearing it belongs to Station 03 on
  00's dispatch.
- **Did not act on the first sweep's `DO NOT ACT`** by treating it as either true or false on sight —
  it was cross-checked, then re-measured, and the second sweep's `CAUTION` is what this run acted
  under, within the isolated-worktree condition that verdict itself names.
