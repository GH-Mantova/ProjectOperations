# Station 00 — Supervisor | 2026-08-30T06:09Z–2026-08-30T06:40Z

SHA this run was true at: `077ea6bc72d9127ec40048f207be0231454c1c36` (dev tree = origin/main, converged).

**THIS WAS A BLIND RUN.** Desktop Commander was absent for the whole run — no PowerShell, no `git`,
no OAuth probe. It was NOT a healthy quiet run. Everything below was taken from the read-write mount
of the real dev tree (`C:\ProjectOperations2`) and from GitHub reads, and every claim says which.

## GROUND

1. **Reach the box:** ❌ **[CANNOT MEASURE]** — `desktop-commander` never finished connecting.
   Four ToolSearch probes across the run (`desktop-commander`, `+desktop-commander`,
   `start_process powershell`, `read_file write_file list_directory start_process`); the last
   returned `No matching deferred tools found` with the server no longer listed as connecting.
   Blindness alternation now: 08-29 18:09 B · 20:09 S · 22:09 S · 08-30 00:09 S · 02:09 B ·
   04:09 **S** · 06:09 **B**.
2. **Station doc read:** ✅ `docs/pipeline/stations/00-supervisor.md` via the mount.
   `station_doc_version: 1` — **matches** the bootstrap's declared `1`. No mismatch, full authority.
3. **DOCTRINE / STATION-CAPABILITIES:** read from the mount. §7 "your instrument lies" applied
   throughout: every count below names the command that produced it.
4. **Validators NOT run** — `check-breadcrumb.mjs`, `lint-*.mjs` and `check-sot-refs.mjs` all
   `execSync` a `git` call, and a VM-side `git` against the Windows `.git` leaves the 0-byte
   `index.lock` that freezes every station. Freshness was therefore done BY HAND from the
   filename stamps, which is the same key the script uses. **This run does not claim
   `breadcrumb-clean`** — the contract forbids that until the validator itself has exited 0.

## WHAT I MEASURED

| claim | instrument | result |
|---|---|---|
| dev tree branch / SHA | `cat .git/HEAD`, `.git/refs/heads/main` | `main` @ `077ea6bc` [MEASURED] |
| convergence | `cat .git/refs/remotes/origin/main` | `077ea6bc` — **identical, converged** [MEASURED] |
| wedge state | existence test on `index.lock`, `MERGE_HEAD`, `REBASE_HEAD`, `CHERRY_PICK_HEAD`, `rebase-merge`, `rebase-apply` | all **absent** [MEASURED] |
| ARMED | `ls -1 docs/pr-prompts/*-ready.md \| wc -l` | **0** [MEASURED] |
| HOLDs at depth 1 | `ls -1 docs/pr-prompts/*-HOLD.md \| wc -l` | **59** (unchanged since #1400 retired 2) [MEASURED] |
| open PRs | GitHub `list_pull_requests state=open` | **0** [MEASURED] |
| last merge | GitHub `get_commit 077ea6bc` | #1400, merged 2026-08-30T04:17:19Z, my own last run's PR [MEASURED] |
| my last 3 breadcrumbs are tracked on main | same commit's file list | 0009, 0209, 0409 all `added` in #1400 ✅ [MEASURED] |
| staged index | — | **[CANNOT MEASURE]** — needs `git`. Not "clean"; unknown. |
| OAuth expiry | — | **[CANNOT MEASURE]** — `find -name .credentials.json` across all 12 mounts returned **nothing**. The token is not on any mounted path. |
| baseline entries | `python3 json.load(...)['entries']` | **23** [MEASURED] |
| structural (gitignored-target) entries | `Counter(missing_path)` over those 23 | **8** — xero-import-report ×2, qa-checklist ×2, relationship-map ×1, qa-findings ×1, needs-marco/pr-188 ×1, GRAPH_REPORT ×1. **Independently reproduces the floor-of-8 recorded in the baseline `_readme` on 08-29.** [MEASURED] |
| GitHub connector write | `create_branch` on `GH-Mantova/ProjectOperations` | **403 Resource not accessible by integration** [MEASURED] — positive control: `list_pull_requests` and `get_commit` on the same connector in the same run both returned 200. |

**Freshness, by hand** (`CADENCE = { '00': 2, '02': null, '03': 24, '04': 4, '05': 24 }`,
`check-breadcrumb.mjs:36`; ages from filename stamps at 06:09Z):

- `00` last `2026-08-30-0409` — **2.0h** / 2h — ok
- `03` last `2026-08-29-2305` — **7.1h** / 24h — ok
- `04` last `2026-08-30-0210` — **4.0h** / 4h — ok (next due ~0610Z)
- `05` last `2026-08-29-1412` — **16.0h** / 24h — ok
- `02` — `null`, dispatch-only
- `06` — **no key at all.** Not measurable by any instrument. See F3.

**No station is SILENT.** No new breadcrumb from any station since my 0409 run, so there was
nothing to COLLECT this run beyond my own prior dispositions.

## WHAT CHANGED

**Nothing on the board, and nothing by my hand.** Board state at 06:40Z is byte-identical to
04:25Z: OPEN 0, ARMED 0, 59 HOLDs, dev tree converged at `077ea6bc`, no lockfiles.

I armed nothing (OAuth block + unmeasurable token), merged nothing (nothing open), and mutated no
tracked file. The only write this run made anywhere is this breadcrumb, written **untracked** into
the dev tree's `docs/pr-prompts/` because F4 removed the only other channel a blind run had.

## FINDINGS

### F1 — 🔴 The `check-sot-refs` exempt-bucket fix was dispatched to a station that structurally cannot perform it. RE-ROUTED.

On 2026-08-29T16:09Z I raised F5 — *"`check-sot-refs.mjs` has an `exempt=` bucket that is
permanently 0, and 8 baseline entries belong in it"* — and dispatched it to **Station 06 (PR Master)**.
That was wrong about *who*, not about *what*.

**[MEASURED]** `scripts/pipeline/check-sot-refs.mjs`:

- `ALLOW_COMMENT_RE = /<!--\s*sot-ref-allow:\s*(.+?)\s*-->/` (line 154)
- the exemption is matched against `line` of `relFile`, where `relFile` is the **`sot/*.md` file
  being scanned** (lines 232–239), and it `continue`s **before** the path-class check and **before**
  the `existsSync` resolution (lines 242, 258).

So the only way to move an entry into `exempt=` is to write `<!-- sot-ref-allow: … -->` **inside a
`sot/` document, on the referencing line itself.** `sot/` is Station 05's exclusive domain, and CP-24
hard-fails any PR mixing `sot/` with code. **Station 06 could not have executed this item on any day,
and neither can I.** It sat in 06's parked queue for 14 hours for a reason that was never about 06's
schedule.

Re-stating it correctly for its real owner:

> **For each of the 8 structural entries only** — those whose target is gitignored *by design*, so
> the `sot/` reference is CORRECT and no fix in `sot/` can ever resolve it — append
> `<!-- sot-ref-allow: target is gitignored by design (.gitignore:NN); reference is correct -->`
> to the referencing line in the `sot/` file, then delete that entry from
> `docs/qa/sot-refs-baseline.json`, in one doc-reconcile PR. The count moves from `baselined=` to
> `exempt=`, which is printed on every run, so nothing is hidden. **Prove the class first**
> (`git check-ignore -v <target>`), and do **not** apply this to the other 15 — those are real debt
> and each needs a judgement call about a deleted doc.

This is the only route by which the burn-down can ever reach 0; the doc currently tells 05 that N
"must be lower than before your PR, never higher" while 8 of the 23 are unreachable by the workflow
it prescribes. RULE 1: complete (removes the permanent floor), additive (adds a comment, changes no
reference, deletes no `sot/` prose), and it cannot damage data entry.

**DISPOSITION: DISPATCHED → Station 05 (SoT Keeper)** — cadence 24h, last ran 16.0h ago, so this
item has a reader with a clock for the first time since it was raised. **Withdrawn from Station 06.**
The durable form is a paragraph appended to the `## SOT-REFS BURN-DOWN` section of
`docs/pipeline/stations/05-sot-keeper.md`; I could not land it this run (F4), so **I also own it**:
if 05 has not acted by my next *sighted* run, I land the doc paragraph myself rather than re-dispatch it.

### F2 — 🟡 Two baseline entries are consumed-prompt churn that the path-class excluder just misses. Options, not a change.

**[MEASURED]** `EXCLUDED_PATH_CLASSES` (line 126) contains exactly one pattern:
`/^docs\/pr-prompts\/.*-ready\.md$/`. Two of the 23 baseline entries are
`docs/pr-prompts/pr-dashboard-gantt-heatmap-widgets-HOLD.md` and
`docs/pr-prompts/pr-dashboard-rename-copyfrom-HOLD.md` — the same churn class (a `-HOLD` is renamed
to `-ready`, consumed into `processed/`, and the `-HOLD` name ceases to exist), escaping the
exclusion only because the `sot/` prose happens to name the pre-arm filename.

RULE 1 tension, stated honestly:

- **(A)** widen the pattern to `-(ready|HOLD)\.md`. Complete for this class and additive — but it
  also blinds the checker to a genuinely mistyped `-HOLD` reference, which is a real (if small)
  loss of coverage. Fails the "without damaging" half at the margin.
- **(B)** treat the two as F1's mechanism instead — `sot-ref-allow` markers with the reason
  *"consumed prompt: renamed to -ready and moved to processed/ by design"*. Complete, additive,
  loses no coverage, and every one is printed on every run. **This is the RULE-1 answer.**

**DISPOSITION: DEFERRED** — folded into F1's re-dispatch to Station 05 as two extra candidates
(taking the reachable set from 8 to 10 of 23), with **(B)** named as the recommended route. Not
urgent: it costs nothing today and the checker exits 0.

### F3 — 🔴 Correction to my own 02:1xZ finding: adding a `'06'` cadence key is NOT unconditionally safe. Escalation refined.

My 08-30T02:1xZ run recorded *"(A) is the RULE-1 answer — adding a key is complete and purely
additive."* **That is half wrong, and the half that is wrong would break every station's preflight.**

**[MEASURED]** `check-breadcrumb.mjs`:

- line 213 marks a station `SILENT` past 2× its cadence;
- line 224: `if (silent) { … process.exit(2); }`
- line 207: a `null` cadence prints `dispatch-only — no cadence to miss` and `continue`s — it can
  never be SILENT.

So:

- `CADENCE['06'] = <any number>` **without** a real scheduled task for 06 makes `--freshness` exit 2
  permanently, on every station's preflight, forever. That is precisely the "damages existing" half
  of RULE 1 — a red instrument nobody can clear is an instrument everybody learns to ignore.
- `CADENCE['06'] = null` is safe and additive, but prints *"dispatch-only — no cadence to miss"* —
  which is **true of 02 and false of 06**. 06 has plenty to miss. It would replace invisible
  parking with a false reassurance, which is worse.

**The two halves of option (A) are not separable.** The CADENCE key is only correct if it lands
*together with* a scheduled task for 06 — and creating that task is Marco's machine, not mine.

**DISPOSITION: ESCALATED (refined, unanswered since 08-29T22:4xZ).** The standing question stands —
**(A)** give 06 a schedule *and* the matching cadence key, **(B)** 00 actions 06's items, **(C)** leave
it — with this correction attached: **do not ship the cadence key alone.** Interim: I have started
doing **(B)** by hand in F1 (taking ownership of an item rather than re-dispatching it into a queue
with no reader), so Marco can see what (B) costs before choosing.

### F4 — 🔴 A blind run now has NO write channel at all. The GitHub connector is read-only.

**[MEASURED]** `create_branch` on `GH-Mantova/ProjectOperations` →
`403 Resource not accessible by integration`. Positive control, same connector, same run:
`list_pull_requests` and `get_commit` both returned 200 with real data. So the integration is
**read-yes / write-no**, not "GitHub is down".

This closes a door several past blind runs left open in their reasoning — *"if Desktop Commander is
absent, land it through the GitHub MCP instead."* **That path does not exist.** Blind, a station can
read the box (mount), read GitHub, and write exactly one thing: an untracked file into the dev tree,
which some later sighted run must sweep up. Half of this station's runs are blind, so half of its
findings can only be parked, and that — not 06's schedule — is the larger reason findings age here.

Do **not** write the breadcrumb to a disposable worktree (dies at teardown) and do **not** write a
file to a path that also exists on `main` (an untracked twin blocks the dev-tree FF — measured
08-29T20:09Z, nineteen of them).

**DISPOSITION: ESCALATED → Marco.** One question, RULE-1 ordered:

- **(A)** grant the GitHub connector `contents: write` + `pull_requests: write` on this one repo.
  Complete (every blind run can then land its own breadcrumb and its own doc fixes as a PR, and the
  parking problem halves immediately) and additive (adds no capability that a sighted run does not
  already have — `gh` is authenticated as GH-Mantova on the box). **Merging is untouched:** it still
  requires `Assert-SmokedOrEscalate` + `Merge-Pr` on the box, so a blind run still cannot merge.
- **(B)** leave read-only and accept that blind runs park everything. Fails the "solves it" half.

### F5 — 🟢 OAuth: thirteen readings, and the fourteenth could not be taken.

**[CANNOT MEASURE]** — `.credentials.json` is on no mounted path (searched all 12 mounts to depth 3).
The last real reading stands: 08-30T04:09Z, expired **35.95h**, file mtime unchanged at
2026-08-28T16:13:26.909Z, 9.075s *before* its own `expiresAt` — the last write stored a credential
already 9 seconds from death, so the failure is in the refresh **response**, not a refresher that
stopped running.

**The OAuth block therefore stands by default. ARM NOTHING.** A run that cannot see the token is not
a run that may assume it recovered.

**DISPOSITION: DEFERRED** — re-measure first thing next sighted run. Unchanged escalation: expired
OAuth needs Marco to re-auth; the guard question (C) is still open.

## WHAT I DID NOT DO

- **Armed nothing.** OAuth block stands and I could not even read the token. ARMED stayed 0.
- **Merged nothing.** OPEN was 0 all run. No `Assert-SmokedOrEscalate`, no `Merge-Pr`.
- **Ran no validator and no `git`** — `check-breadcrumb.mjs --freshness`, `lint-prompt.mjs`,
  `lint-station.mjs` and `check-sot-refs.mjs` all shell out to `git`, and a cut-short VM-side `git`
  call against the Windows `.git` leaves the lock that freezes every station. Freshness was done by
  hand and is labelled as such. **No `breadcrumb-clean` claim is made by this run.**
- **Did not edit `docs/pipeline/stations/05-sot-keeper.md`.** It is the right home for F1 and I had
  the exact text, but the file is canonical-block hashed by `lint-station.mjs` and the only write
  channel available (F4) would have required me to re-transmit all 351 lines by hand. A
  transcription slip there breaks CI for every station. Deliberately deferred to a sighted run.
- **Did not touch `docs/qa/sot-refs-baseline.json`.** Same reason, and its `_readme` is a single
  enormous JSON string.
- **Did not run `status-sweep.ps1`, did not check the watcher process, did not FF the clone.** All
  need the box. The 04:09Z readings (watcher pid 26364 running, `SAFE TO ACT`) are **stale by 2.5
  hours and must not be reused** as if measured.
- **Did not re-raise** the CP-26 ruleset question, the `needs-marco/` inflation, the `metadata-catalog.json`
  CRLF artifact, or the 35-file `verdict-archive` amber. All unchanged and all already on the board.
