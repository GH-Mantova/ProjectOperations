# Station 04 — Scanner | 2026-09-04T06:10:49Z–2026-09-04T06:33Z

Sweep this run: **instruction-drift** (rotation position 4 of 4, assigned by
`node scripts/pipeline/next-sweep.mjs`; previous run 2026-09-04T02:10:41Z).

## GROUND

```
UTC            2026-09-04T06:10:49Z
origin/main    dd7db248               (git fetch origin --prune, then rev-parse)
dev tree       main @ dd7db248        C:\ProjectOperations2   (HEAD == origin/main)
doc version    1                      (docs/pipeline/stations/04-scanner.md front matter)
bootstrap      1                      (C:\Users\Marco\Claude\Scheduled\04-scanner\SKILL.md)
```

Doc version and bootstrap **AGREE** — this run had full authority.
**SIGHTED, not blind:** `start_process` shell `powershell.exe` returned PID 23408 on the first call
(`Get-Date` → `2026-09-04T16:10:49.3362520+10:00`, `hostname` → `LAPTOP-E6NHU4E4`).
Read in the **dev tree**, never the watcher clone.

## WHAT I MEASURED

**Sweep.** `powershell -NoProfile -File scripts\pipeline\status-sweep.ps1` at 06:12:45Z and again at
06:13:04Z. Section 0 controls both PASS (`gh` reached GitHub, saw merged #1569; `node` runs).
VERDICT: **CAUTION** — 1 LIVE STATION WORKTREE (`C:/po-queue`, dirty=3, age 21 min). I am read-only
on the board and mutated nothing, so the caution did not bind any action I took.
[MEASURED] open PRs **0**; armed `*-ready.md` **0**; backlog `ready=1 needs-marco=2 blocked=4 broken=0`.

**Version parity, bootstrap vs repo station doc, all five live bootstraps.** [MEASURED] via
`drift-check.mjs` reading each `SKILL.md`, resolving the station doc it names, and reading that doc
from `git show origin/main:<path>`:

| bootstrap | boot | doc | verdict |
|---|---|---|---|
| `00-supervisor` | 1 | 1 | MATCH |
| `02-board-driver` | 1 | 1 | MATCH |
| `03-machine-minder` | 1 | 1 | MATCH |
| `04-scanner` | 1 | 1 | MATCH |
| `05-sot-keeper` | 1 | 1 | MATCH |

`weekly-security-audit` declares no `station_doc_version` and names no station doc — it is not a
pipeline station and is out of scope, not a mismatch. `_retired-2026-08-18/**` excluded by design.
**Positive control:** the same probe DID produce a non-MATCH row (`weekly-security-audit`), so a
uniform "MATCH" is not what a blind probe returns here.

**`lint-station.mjs`.** [MEASURED] `node scripts/pipeline/lint-station.mjs` → `ADMIT: all 8 docs
clean`, **exit 0**. Seven station docs + DOCTRINE, plus `ADMIT .claude/agents/*.md (9 agent
definitions, encoding clean)`.

**Path resolution — every file-shaped repo path named in DOCTRINE, STATION-CAPABILITIES and all
seven station docs, checked against `git ls-tree -r origin/main`.** [MEASURED] 205 occurrences
checked, 149 resolved, **11 distinct dangling**. Triaged, each with `git check-ignore -v`:

- 6 are **gitignored, therefore correctly absent from `main`**, and 5 of the 6 exist on disk:
  `.claude/agents/pr-tester.md` (`.gitignore:28`), `apps/api/scripts/xero-import-report.md`
  (`:86`), `docs/data-model/relationship-map.json` (`:127`), `docs/data-model/relationship-map.md`
  (`:128`), `apps/api/.env` (`:10`), `apps/web/.env.local` (`:11`, absent on disk — expected).
- 4 are the known-gitignored queue subfolders (`.gitignore:76-83`).
- 1 is `docs/qa/Master-QA-and-Consolidation-Program-Plan.md`, named in `04-scanner.md` **only** in the
  sentence that records it was deleted in the 2026-08-17 cleanup. A historical reference, not a live
  pointer.

⇒ **No unexplained dangling path in any binding document.** **Positive control:** the probe found 11
and correctly re-found `.claude/agents/pr-tester.md`, which `STATION-CAPABILITIES.md` already
documents as untracked (measured 2026-09-03 by this station) — so it is not a blind zero, and
`pr-tester.md` is **not** re-filed as new.

**The freshness instrument the canonical contract mandates.** [MEASURED] Four transforms of the same
file, `docs/pipeline/DOCTRINE.md`, in the dev tree at `dd7db248`, `HEAD == origin/main`:

```
git rev-parse origin/main:docs/pipeline/DOCTRINE.md          -> e3a1b3bd…   (true blob)
git hash-object docs/pipeline/DOCTRINE.md                     -> e3a1b3bd…   (clean filter applied)
git hash-object --no-filters docs/pipeline/DOCTRINE.md         -> 6f7bfc5e…   (raw CRLF on disk)
git show origin/main:…DOCTRINE.md | git hash-object --stdin    -> be52d8b9…   (PowerShell pipe)
```

`git cat-file -s` → **58731** blob bytes; `Get-Item .Length` → **59548** on-disk bytes (817 CR bytes,
817 lines). The same PowerShell-piped command under **`cmd /c`** returns **`e3a1b3bd…`**, the true
blob. Reproduced on all three binding docs (`04-scanner.md`, `DOCTRINE.md`,
`STATION-CAPABILITIES.md`) — piped value differs from the true blob in all three.
`git diff --stat origin/main -- <the three paths>` returned **EMPTY**, exit 0.

**The mandated ToolSearch selector.** [MEASURED] Run verbatim from preflight step 1:
`select:mcp__remote-devices__plugin_desktop-commander_desktop-commander__start_process,mcp__remote-devices__device_bash`
→ **"No matching deferred tools found."** **Positive control:** a keyword query
(`"desktop-commander start_process interact_with_process read_file"`) returned the whole toolkit, and
the tool that opened this run's shell is `mcp__plugin_desktop-commander_desktop-commander__start_process`
— **no `mcp__remote-devices__` prefix**. A second query for `device_bash / device_stage_files /
device_commit_files` returned none of them; they are absent from this session's entire tool inventory.

**Bootstrap coverage of the blindness correction.** [MEASURED] all five live `SKILL.md` files grepped:

| bootstrap | `blind` | `ToolSearch` | `schema` | `remote-devices` |
|---|---|---|---|---|
| 00, 02, 03, 04, 05 | **True** | False | False | False |

**Staged-prompt state.** [MEASURED] `node scripts/pipeline/lint-prompt.mjs
docs/pr-prompts/pr-preflight-tool-names-are-environment-specific-HOLD.md` → **`ADMIT (size 3)`,
exit 0**. Don't-arm marker union, case-sensitive, all three markers: `watcher: do-not-arm` 0,
`DO NOT ARM` 0, `Arm ONLY` 0. **Positive control:** the same three patterns against
`pr-524-rates-b-slice2-canonical-HOLD.md` → 0 / **1** / **1**, so the probe is not returning a
uniform zero.

**Missed-caller grep.** [MEASURED] `git grep -c 'mcp__remote-devices__' origin/main` → the 7 station
docs, 4 archived breadcrumbs, and the HOLD itself. `git grep -c 'device_bash' origin/main` → the 7
station docs (2 each), 4 archived breadcrumbs, the HOLD, **and
`docs/pipeline/STATION-CAPABILITIES.md` (1)**.

## WHAT CHANGED

**Nothing on the board.** No PR opened, no prompt armed, disarmed, renamed, moved or deleted; no
merge; no label touched; no `/sot/` edit; no worktree created or pruned; no tracked file modified.

Two intended dirty artefacts in the dev tree, both for Station 00 to commit because 04 may not:

1. This breadcrumb, `docs/pr-prompts/00-04-scanner-2026-09-04-0610-the-mandated-freshness-probe-returns-a-sha-that-matches-nothing.md` — untracked.
2. `docs/pipeline/sweep-rotation.json` — advanced with
   `node scripts/pipeline/next-sweep.mjs --advance --utc 2026-09-04T06:10:49Z`, exit 0
   (`last_index=3 last_run_utc=2026-09-04T06:10:49Z`). **Left dirty deliberately. Station 00 must
   commit it or the rotation stops turning.**

🔴 **Three other dirty entries in `docs/pr-prompts/` are NOT mine — do not attribute them to this
run.** [MEASURED] `git diff --cached --name-status` → **empty**, so nothing is staged and 00 can
commit the two files above with a pathspec safely. `git diff --name-status` additionally shows
`M docs/pr-prompts/.arming-log.txt` and `D docs/pr-prompts/pr-watcher-merge-policy-nested-test-paths-HOLD.md`.
Cause, measured: **another actor armed a prompt nine minutes into this run** — `.arming-log.txt` tail
reads `2026-09-04T06:19:49Z ARMED pr-watcher-merge-policy-nested-test-paths escalates=true by=Marco@
pid=14292 caller=powershell.exe:28128`, and the `-ready.md` variant is now on disk while the `-HOLD.md`
is gone. Also untracked and not mine: `.queue-sync-ledger.txt`,
`archive/review-escalations-516-1346/`, `queue-watch-state.md`,
`superseded/pr-doctrine-s9-four-false-traps-LOOPING.md`.

## FINDINGS

### F1 — The freshness probe the canonical contract mandates returns a SHA that matches no object in the repository and no file on disk. PowerShell only. [S2]

`station-contract v2` preflight step 2 — **byte-identical in all seven station docs** — and
DOCTRINE §9's freshness cure both prescribe
`git show origin/main:<path> | git hash-object --stdin`. In `powershell.exe`, **the shell every
station is instructed to use in step 1**, that command returns `be52d8b9…` for `DOCTRINE.md`, which
is neither the blob (`e3a1b3bd…`) nor the bytes on disk (`6f7bfc5e…`). It is an artifact of
PowerShell's native-command pipe, which decodes `git show`'s stdout to strings and re-emits it
re-encoded; `--stdin` has no path, so no `text=auto` filter runs to undo it. Under `cmd /c` the
identical pipeline returns the true blob. Both forms **exit 0** and both print a well-formed 40-hex
SHA, so nothing warns — and §9.6's *"an empty result is not an empty world"* does not fire, because
nothing is empty.

**This corrects, in mechanism, the note Station 00 wrote 30 minutes before this run.**
`00-00-supervisor-2026-09-04-0540-…md:16-22` hit the same disagreement and concluded it was
"the CRLF smudge, not a content diff". The boolean conclusion was right and 00 correctly refused to
act on it — but the cause is misattributed, and it matters: `git hash-object <path>` **already
returns the true blob** (measured, `e3a1b3bd…`), so the working tree is not the odd one out and
renormalising it, or touching `.gitattributes` / `core.autocrlf`, would be a no-op that leaves the
actual lie in place. The unsound half is specifically `| git hash-object --stdin` **under PowerShell**.

Station 03's 2026-09-03 per-tree measurement (`0e9e14d9` vs `860b5e32`) **still stands** — it
compared the same corrupted transform across two trees, which is internally consistent. What breaks
is any comparison of the piped value against a true SHA, against `git rev-parse`, against a value
taken in bash/node/CI, or against a value recorded on another day. This run made exactly that
comparison and briefly read **all three of its own binding documents as stale**.

**RULE 1 options.** (a) **Complete and additive — replace the probe with
`git rev-parse origin/main:<path>` for "which blob" and `git diff --numstat origin/main -- <path>`
for "is it different".** Neither pipes, neither re-encodes, both are byte-identical in PowerShell,
cmd, bash and node, and both return true git object identity. Additive: it invalidates no prior
reading, because every prior reading compared like with like. (b) Keep the piped form and add a
warning that it is only valid tree-to-tree — fails *completely*, since it leaves a live footgun in
step 1 of every run. (c) Do nothing and rely on stations noticing — fails both halves; two stations
in one hour already did not, and one wrote the wrong cause into a breadcrumb.

The command lives inside the hash-gated canonical block, so the change must go to all seven station
docs plus `_canonical-blocks.json` via `lint-station.mjs --write-canonical`, in one PR.

**DISPOSITION: DISPATCHED** → Station 00. Handed over: the four-transform measurement, the `cmd /c`
control, the correction to the 05:40Z breadcrumb's stated cause, and RULE-1 option (a) as the fix to
stage. 04 is read-only on the board and does not open PRs.

### F2 — The staged prompt that fixes preflight step 1 is a verified live candidate, and it has a missed caller. [S2]

`docs/pr-prompts/pr-preflight-tool-names-are-environment-specific-HOLD.md` (staged 2026-09-02) is
**ADMIT, size 3, exit 0**; scope is 8 files, all under `docs/pipeline/stations/`, so it is entirely a
`docs/` change — a tests/docs-lane prompt, **not** Marco's under `classifyPolicyFiles`;
`escalates: false`, `gate_allow: none`; and it carries **none** of the three don't-arm markers
(probe controlled against `pr-524`). **Its premise is alive as of today:** the mandated selector
returned "No matching deferred tools found." this run. It has sat un-armed for two days while every
station's every run begins with a step-1 command that cannot work.

Adversarial critique of it, per this station's contract:

- **Premise dies on landing (LL-54): PASS.** `grep -q "mcp__remote-devices__" 00-supervisor.md`
  inverts the moment the string is gone.
- **Guards it could trip: covered.** The canonical-block hash check will red-fail unless
  `_canonical-blocks.json` is re-recorded — that file *is* in scope and `done_when` calls
  `lint-station.mjs`.
- **Honest `size`: acceptable.** Eight files, but seven are one byte-identical block plus a hash
  re-record.
- **Rollback: N/A** — no schema, migration or backfill.
- 🔴 **MISSED CALLER — S2.** `docs/pipeline/STATION-CAPABILITIES.md` names `device_bash` and heads a
  section *"The device bridge (`device_bash`, `device_stage_files`, `device_commit_files`)"*
  describing it as a live capability — *"Useful as a fallback when Desktop Commander is absent, for
  read-only checks only."* **None of those three tools exists in this session's tool inventory**
  (measured). That file is **not** in `scope`, and `done_when` greps only `00-supervisor.md`, so the
  prompt would pass green while leaving two binding documents disagreeing about which tools exist —
  and leaving a station whose Desktop Commander fails hunting a fallback that is not there, or
  presenting device-bridge reads as coverage. **Add `docs/pipeline/STATION-CAPABILITIES.md` to
  `scope` and extend `done_when` to assert the absence there too, before arming.**

**DISPOSITION: DISPATCHED** → Station 00. Handed over: today's premise re-verification, the ADMIT and
marker readings with their positive controls, and the one scope correction required before it is
armed. 04 arms nothing.

### F3 — `lint-station.mjs` compares two independent version counters, so its NOTE fires on every clean run and names the wrong number to match. [S2]

`scripts/pipeline/lint-station.mjs:223` computes
`const off = [...versions.entries()].filter(([, v]) => v !== contractV)`, where `versions` holds each
doc's **`station_doc_version`** (set at `:170`) and `contractV` is the **canonical block's contract
version**. These are independent counters. `station_doc_version` is `1` in all seven docs and
`04-scanner.md` states that bumping it is **forbidden**; the block has been bumped to v2. So `off` is
guaranteed to contain all seven docs forever, and the NOTE printed at `:226-228` fires on every
otherwise-clean `ADMIT` — as it did this run.

Worse than noise: `:228` reads *"the scheduled-task bootstrap must declare the same number, or the
run goes read-only"*, and the number it has just displayed is the **contract** version. A station
that obeys it literally either (i) reads a mismatch where the preflight rule says there is none and
goes read-only on a healthy run — one run lost, silently — or (ii) "fixes" it by bumping
`station_doc_version` in all seven docs, which is the one edit the contract forbids, at which point
all five bootstraps mismatch for real and **all seven stations go read-only at once**.

Sub-finding, measured: all seven station docs declare **`contract_version: 1`** while carrying a
block labelled **`station-contract v2`**. The front-matter field whose whole job is to record which
contract the doc carries is itself stale — and it is the field `:223` should have been reading.

**RULE 1 options.** (a) **Complete and additive — point `:223` at `contract_version` (already parsed
and validated at `:122`) instead of `station_doc_version`, retitle the NOTE to name that field, and
bump `contract_version: 1` → `2` in all seven docs in the same PR.** `station_doc_version` stays
frozen as the contract requires; the check becomes meaningful, firing only when someone bumps the
block without bumping the docs — a real defect it currently cannot see; and nothing that reads
`station_doc_version` changes behaviour. (b) Delete the NOTE — fails *completely*, discarding a check
that would be real once corrected. (c) Leave it and add a comment — fails both halves; the misleading
advice keeps printing.

**DISPOSITION: ESCALATED** → Marco. The fix lands in `scripts/pipeline/lint-station.mjs`, which is
outside `^(tests|docs)/` and therefore routes to Marco's lane, and option (a) also asks to change a
version field in seven binding documents. **The question: approve option (a) — repoint the check at
`contract_version` and bump that field to 2 in all seven station docs, one PR?** Options (b) and (c)
above with the half each fails. Nothing here is urgent to the point of acting without him; the
present cost is a misleading NOTE on every clean run, and the risk is the "fix" being guessed wrong.

### F4 — The correction that prevents a false blindness call exists only in the layer that is read too late. [S2]

All five live bootstraps say **"blind"** and instruct: on a failed `start_process`, *"write one
paragraph saying you are blind … and END THE RUN."* **None of the five mentions `ToolSearch` or
schema loading** (measured, table above). The correction — *"Load the tool schema FIRST. A validation
error is not blindness … Declaring blindness without loading first is a §7 instrument lie, in the one
step every run begins with"* — lives only in the repo station docs, which the bootstrap tells the
agent to read at **STEP 2**, *after* the STEP 1 stop it would have prevented. The bootstrap's own
stop condition therefore fires before the text that disarms it can be read, in every run of every
station.

This is precisely the failure the instruction-drift sweep exists to catch: *"five pasted copies
drifted for weeks and four carried advice this pipeline had already disproved."* It is live and
unfixed in all five. Note that the sweep's remit is the bootstraps' **content**, and the bootstraps
are outside the repo — no PR can reach them, which is likely why the correction was never propagated.

Cheapest complete cure, additive and inside the repo: make the bootstraps' STEP 1 stop conditional in
the *repo* layer by having the station doc's step-1 text be the only stop authority, and have
`lint-station.mjs` assert that any bootstrap it can see names `ToolSearch` — but a bootstrap edit
still needs a hand on Marco's machine. Recording the option, not choosing it: the ordering defect is
the finding; the delivery mechanism is 00's and Marco's to pick.

**DISPOSITION: DISPATCHED** → Station 00, which owns the bootstrap layer and the only channel that
closes. Handed over: the five-bootstrap grep table and the ordering argument (STEP 1 stop precedes
STEP 2 read). Deliberately **not** folded into F2 — F2 fixes *which tool ids* step 1 names; F4 is
that the bootstrap stops the run before the doc containing any correction is read. Same paragraph,
two different defects.

### F5 — `[LIVE]` decayed inside this one run: `armed` went 0 → 1 at 06:19:49Z, by an unattributable actor, on a prompt marked `escalates=true`. [S3, evidence for open escalation #22]

[MEASURED] `status-sweep.ps1` at 06:12:45Z reported `armed (*-ready.md): 0`. At 06:21:16Z the same
directory held **one** `*-ready.md`, `pr-watcher-merge-policy-nested-test-paths-HOLD.md` was gone from
disk, and `.arming-log.txt` recorded `2026-09-04T06:19:49Z ARMED
pr-watcher-merge-policy-nested-test-paths escalates=true by=Marco@ pid=14292
caller=powershell.exe:28128`.

Two things worth keeping, neither of them a new escalation:

1. **A worked demonstration of the contract's own warning**, on the shortest clock yet recorded here:
   *"`[LIVE]` means 'true when measured', not 'true now.'"* The census I was entitled to quote decayed
   **within seven minutes**, in the same run that measured it. Any station about to act on an `armed`
   count must re-read it immediately before acting, not once at preflight.
2. **A fresh instance of open escalation #22** — an arm this pipeline cannot attribute. `by=Marco@`
   names nobody, and the arm landed on a prompt whose own front matter says `escalates=true`. This is
   the same shape as the four arms in 28 h that were not Station 00's. Recording it as **evidence for
   #22**, deliberately **not** as a new escalation, and deliberately not acted on: 04 is read-only,
   and #22's cure (have `arm-prompt.ps1` write `ARM_ACTOR` plus the parent cmdline, and track the log)
   is already before Marco.

**DISPOSITION: DEFERRED.** Real, not now. It becomes urgent the moment an unattributable arm lands on
a prompt that is **not** `escalates=true` — i.e. one the watcher would pick up and run without a human
gate — or if #22's actor-recording cure is declined, at which point the pipeline permanently cannot
answer "who armed this". Handed to 00 only as a data point under #22; nothing to fix in 04's lane.

## WHAT I DID NOT DO

- **Mutated nothing on the board.** Verdict was CAUTION with a live station worktree at `C:/po-queue`
  (dirty=3, age 21 min); 04 is read-only regardless, so the caution constrained nothing I attempted.
- **Armed nothing.** `pr-preflight-tool-names-are-environment-specific-HOLD.md` is ADMIT with its
  premise verified alive today and no don't-arm marker, and it is still a **candidate only** — ADMIT
  is necessary, not sufficient (RULE 4), and arming is 00's on Marco's authority. I did not rename,
  move or touch it.
- **Did not edit the prompt I critiqued.** The report-not-run rule is absolute: F2's missed caller is
  reported, not patched.
- **Did not commit `sweep-rotation.json` or this breadcrumb.** The dev tree is on `main`, which nobody
  commits to directly, and the authority matrix gives 04 *Create a PR: NO*. Both are left dirty and
  named above.
- **Did not mint a worktree.** Read `origin/main` at a named SHA with `git show` / `git rev-parse`, per
  the 2026-08-24 supersession.
- **Did not re-file `.claude/agents/pr-tester.md`.** Already measured and documented in
  `STATION-CAPABILITIES.md` on 2026-09-03; it surfaced again only as the positive control for the
  path-resolution probe.
- **Did not clear the two `[STALE]` escalation files or the two worktree registry-escapees** the sweep
  named — Station 03's and 00's lanes.
- **Skipped Parts 1 and 2 of the station brief** (GitHub reconciliation, live-site visual patrol).
  The assigned sweep was instruction-drift and the contract says cover ONE sweep completely rather
  than pass shallowly over everything. The `github-projectops` MCP also failed to connect this session
  (`400: Authorization header is badly formatted`) — [CANNOT MEASURE] via that connector; `gh` in a
  shell did work and status-sweep's GitHub section is `[LIVE]`.
- **Did not touch `/sot/`, source, Azure, Entra or SharePoint.**

---

*Untracked until a board PR commits it. Station 00 sweeps it up.*
