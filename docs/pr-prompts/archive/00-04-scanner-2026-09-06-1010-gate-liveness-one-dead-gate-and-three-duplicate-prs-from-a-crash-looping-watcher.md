# Station 04 — Scanner | 2026-09-06T10:10:36Z–2026-09-06T10:45Z

## GROUND

```
UTC            2026-09-06T10:10:36Z
origin/main    b9c1dd5d            (git fetch origin, then git rev-parse origin/main)
dev tree       main @ b9c1dd5d     C:\ProjectOperations2   (rev-list --left-right --count = 0 0)
doc version    1                   (docs/pipeline/stations/04-scanner.md front matter)
bootstrap      1                   (scheduled-task SKILL.md, station_doc_version: 1) — MATCH
```

SIGHTED. `start_process` shell `powershell.exe` → pid 12432, first call, no retry. Not a blind run.

The three binding documents were read from the dev tree, which is byte-identical to `origin/main`
for all three: `git diff --numstat origin/main -- docs/pipeline/stations/04-scanner.md
docs/pipeline/DOCTRINE.md docs/pipeline/STATION-CAPABILITIES.md` → **EMPTY** (§9.3's sound form; no
piped hash was taken, no length was compared).

`status-sweep.ps1` (captured to a file through `cmd /c` so PS 5.1's UTF-16LE `>` never touches it):
**§7 VERDICT — SAFE TO ACT.** Section 0 controls both PASS. 5 open PRs, trunk green 4/4 on
`b9c1dd5d`, watcher RUNNING, no `index.lock`, 0 git processes, 0 in-progress prompts.

**Named sweep this run: `gate-liveness`** — `node scripts/pipeline/next-sweep.mjs` → rotation
position 1 of 4, previous run 2026-09-06T06:48:33Z. Advanced with
`--advance --utc 2026-09-06T10:10:36Z`; see WHAT CHANGED.

## WHAT I MEASURED

**Gate liveness, the whole board.** [MEASURED] `triage-holds.ps1` over the 71 depth-1 `-HOLD.md`:
`spent=0  gates-satisfied=33  still-gated=38  unreadable=0`. Both of its own controls passed (GIT
control read 96497 chars of DOCTRINE from `origin/main`; SPENT control emitted exit 3 on the
fixture), so the empty SPENT bucket is a measurement and not a broken query. **No prompt on the
board has a premise that has already been satisfied.**

**Every `requires_*` gate, resolved against `origin/main:b9c1dd5d` the way `lint-prompt.mjs`
resolves it.** [MEASURED] scratch harness `C:\po-sup-fix-scripts\gate-liveness2-04-20260906.mjs`,
which reproduces `checkGateNotReleased`'s three cases (file absent / needle absent / satisfied) and
distinguishes BROKEN from ABSENT rather than folding one into the other:
`satisfied=10  unmet=27  broken=0`. **Two-sided control: SATISFIED>0 and UNMET>0 both observed**,
so neither bucket is an artefact. Producer corpus 192 files; fresh negative needle → 0.

**Producer search over the 27 unmet gates.** [MEASURED] Same harness. 21 of 27 name a path that
another live prompt in the queue produces. Six have **no producer anywhere** in
`docs/pr-prompts/` at depth 1, in `needs-marco/` or in `blocked/`:

| gate | verdict |
|---|---|
| `docs/approvals/rates-b-slice2-canonical-approved-by-marco.md` | Marco approval, by design |
| `docs/approvals/rates-s11c-drop-legacy-tables-approved-by-marco.md` | Marco approval, by design |
| `docs/approvals/retire-tenderclientnote-s2-approved-by-marco.md` | Marco approval, by design |
| `docs/approvals/siteid-notnull-backfill-approved-by-marco.md` | Marco approval, by design |
| `docs/approvals/tenant-mt4-s2-ownership-migration-approved-by-marco.md` | Marco approval, by design |
| `docs/data-model/rates-migration/STEP-11C-DONE.md :: ESTIMATE_WASTE_RATES_DROPPED` | **DEAD — F1** |

**The approval convention is real, not aspirational.** [MEASURED] `git ls-tree -r --name-only
origin/main -- docs/approvals/` (trailing slash and `-r`, per §9.2) returns
`docs/approvals/README.md` and `docs/approvals/watcher-identity-approved-by-marco.md` — a README
plus one precedent that was actually exercised. POS control: the same query over
`docs/pr-prompts/` returns 836. So the five approval gates above wait on a documented human act,
not on a convention nobody invented. ⚠️ They are, however, invisible from the five documents a
reader would check: `git show origin/main:<f>` contains `docs/approvals` → **silent** for
DOCTRINE.md, PROMPT-SCHEMA.md, sot/README.md, sot/05-decisions-and-lessons.md and
00-supervisor.md. See F3.

**The STEP-\*-DONE marker convention is also real.** [MEASURED] Exactly two tracked markers exist
on `origin/main` — `docs/data-model/rates-migration/STEP-11A-DONE.md` and `STEP-11B-DONE.md` —
found by filtering all 3178 tracked paths in node, never by globbing an `ls-tree` pathspec (§9.2).
So 11C's marker is the missing third in a live series, not a naming difference. That is why its
absence from every producer is a defect.

**No dead `requires_merged` gate.** [INFERRED, from the triage buckets] All six prompts declaring
one (#1361, #1317, #1351, #1348, #1257, #1111) are ADMIT, or rejected for a reason other than
`GATE_NOT_RELEASED`, so none is parked on an unmerged PR. The 2026-09-03 run measured all six
`MERGED` directly; nothing has closed since.

**`scope:` is ADVISORY, not enforced.** [MEASURED] `git show origin/main:<f>` for
`scripts/pr-gates/pr-gates.mjs` and `scripts/pr-watcher/index.mjs` → **zero** lines reading a
prompt's `scope` field; `scripts/pipeline/lint-prompt.mjs` reads it in 8 places, all for lint
decisions (module derivation, DB reachability, title scope), none of which constrains which files a
build may write. This is the control that keeps F2 an S3 and not a second dead gate.

**Part 0 (a) — authorization parity — CLEAN, with the mandated positive control.** [MEASURED]
`git grep -nE 'permissions\??\.includes\(' origin/main -- apps/web/src/` → **16** call sites.
**15** carry `isSuperUser` within ±5 lines. The one that does not is
`apps/web/src/auth/__tests__/superuser-parity.guard.test.ts:28` — the guard test's own assertion
string, i.e. the enforcement, not an offender. POS control: **43** files use the sanctioned
`can()` / `isAdminUser()` helpers. Redirect guards: 44 `<Navigate>` sites; files carrying BOTH a
`<Navigate>` and a bare `permissions.includes(` with **no** `isSuperUser` anywhere → **0**. NEG
control, fresh needle → 0. **No new offender that the `superuser-parity.guard.test.ts` baseline
does not already cover.**

### Corroboration, NOT a finding — the three duplicate PRs and the dark launch log are already reported

I measured both before reading the queue's newest breadcrumbs. **Both were already filed by
Station 00, two minutes before this run started**, so they are recorded here as independent
corroboration and are **not** re-filed as 04 findings:

- `00-00-supervisor-2026-09-06-1008-the-watchdog-kill-loop-built-one-prompt-three-times-and-put-three-duplicate-prs-on-the-board.md`
- `00-00-supervisor-2026-09-06-0930-…-judges-a-new-node-by-the-old-heartbeat.md`, **F9**, which
  already names `watcher-launch.log` as stale-while-answering and dispatches it to Station 03.

What I measured independently, and where it agrees: one arm
(`.arming-log.txt` → `2026-09-06T09:20:50Z ARMED pr-watcher-verdict-home-resolver …
actor=station-00-scheduled-0908Z`), three PRs 90 seconds apart (#1703 `09:53:09Z`, #1704
`09:54:01Z`, #1705 `09:54:39Z`), all three with the identical two-file list
(`scripts/pr-watcher/index.mjs`, `scripts/pr-watcher/__tests__/verdict-home-resolver.test.mjs`),
and `ensure-watcher.log` showing `RELAUNCHED` at `09:25:04Z`, `09:35:06Z`, `09:49:32Z`. 00's run
went further and hashed the diffs (#1704 ≡ #1705; #1703 a different implementation) — read its
table, not mine.

Two increments this run adds, both small:

1. **The prompt is now consumed.** 00 measured `pr-watcher-verdict-home-resolver-ready.md` still
   armed at 10:09Z. [MEASURED] at 10:2xZ `Get-ChildItem docs\pr-prompts\*-ready.md` → **empty**,
   and `Select-String -Path processed\pr-watcher-verdict-home-resolver*.log` → still **0**. So the
   loop ended in the worst of both: the prompt is spent and no verdict was ever written.
2. **A sharper control on the dark log.** [MEASURED] across **all 185** `*.log` files under
   `C:\po-watcher` (recursive): hits for `#1703` → **0**; POS control `#1685` → **45**; NEG
   control, fresh needle → **0**. `ensure-watcher.log` contains `opened PR #` **0** times. So the
   three PRs are recorded in *no* watcher log anywhere, not merely in a stale one — which is the
   stronger form of 00's F9 and of its consequence for DOCTRINE §10.1's lane discriminator.

Lane classification of the three, since no verdict exists and none can:
`[NO LANE VERDICT — hand-classified]`. `scripts/pr-watcher/index.mjs` matches none of the three
`NESTED_TEST_PATHS` forms, so `classifyPolicyFiles` refuses — **all three are Marco's.** Same
answer 00 reached.

**Watcher liveness, re-measured at the end of the run because `[LIVE]` expires.** [MEASURED]
`Get-CimInstance Win32_Process -Filter "Name='node.exe'"` → 33 node processes (POS control), of
which **1** matches `*pr-watcher*index.mjs*`: **pid 15336**, at `2026-09-06T10:32:28Z`. ⚠️ An
earlier read of that same probe appeared to return an empty list and I nearly filed *"the watcher
is down"*. It was a **streamed-output early return** (§9.1) — the pid line was still pending when I
read. Recording it because that bullet is usually treated as a nuisance and it is not: it
manufactures a clean, well-formed, wrong liveness reading, which is §7's exact shape.

## WHAT CHANGED

- **Advanced the sweep rotation.** `docs/pipeline/sweep-rotation.json` is **modified and
  uncommitted** in the dev tree (`git status --porcelain` → ` M docs/pipeline/sweep-rotation.json`;
  `last_index=0 last_run_utc=2026-09-06T10:10:36Z`). **Station 00 must commit it** — 04 may not
  commit to the shared dev tree — or the next run repeats gate-liveness.
- **This breadcrumb**, at `docs/pr-prompts/00-04-scanner-2026-09-06-1010-…md`. Untracked until a
  board PR commits it; a breadcrumb filename matches no watcher glob, so it arms nothing.
  `node scripts/pipeline/check-breadcrumb.mjs` → **CLEAN**, exit 0, this file `ADMIT`.
- **Nothing else.** No prompt armed, disarmed, staged, renamed, moved or deleted. No PR opened,
  closed, labelled or merged. No `/sot/` edit. No `git checkout`/`reset`/`stash`/`clean` anywhere.
  No Azure / Entra / SharePoint contact of any kind. No throwaway worktree minted.
- Scratch only, outside the repo, under `C:\po-sup-fix-scripts\`:
  `sweep-04-20260906-1010.txt`, `triage-04-20260906-1015.txt`, `gate-liveness-04-20260906.mjs`,
  `gate-liveness2-04-20260906.mjs`, `approvals-04-20260906.mjs`, `step11c-04-20260906.mjs`,
  `tipid-04-20260906.mjs`, `scope-and-part0a-04-20260906.mjs` and their outputs. None is in
  `docs/pr-prompts/`.

## FINDINGS

### F1 — S2 — A dead gate that the previous gate-liveness run certified alive, by inference

`pr-tipid-s3-retire-the-name-guard-for-an-id-check-HOLD.md` declares three `requires_on_main`
gates. The third is:

```
- docs/data-model/rates-migration/STEP-11C-DONE.md :: ESTIMATE_WASTE_RATES_DROPPED
```

**Nothing in this repository is instructed to write that file or that token.** [MEASURED]
`git grep -l -I --fixed-strings STEP-11C-DONE origin/main -- docs/` returns exactly two files: the
consumer itself, and an archived Station 04 breadcrumb. The natural producer —
`pr-rates-s11c-drop-legacy-tables-HOLD.md`, the only prompt that drops `estimate_waste_rates` —
contains `STEP-11C-DONE` **false** and `ESTIMATE_WASTE_RATES_DROPPED` **false**. Its `scope:` does
include `docs/data-model/**`, so it *could* write the marker; it is simply never told to.

**Why this was not caught before, and that matters more than the gate does.** The 2026-09-03T18:10Z
Station 04 breadcrumb listed this exact path among nine absent gate targets and concluded:
*"[INFERRED] Every one is produced by a prompt still live in the queue (cardui s6->s7->s8, sor-s9a,
**tipid s1->s2->s3**, ew-s2d->s4, fv2-ai-import) … **None is dead**; the chains are intact."* The
inference reads the gate's *consumer* chain and assumes that chain also produces it. For two of
tipid-s3's three gates that holds — s2 produces the backfill script and the audit receipt. For the
third it does not: `STEP-11C-DONE` belongs to the **rates-11c** chain, which is not in that list.
The tag was honest; the conclusion was never measured. And a *"None is dead"* sitting in a
breadcrumb is what the next run reads instead of re-measuring — §7.1's re-read rule, earning its
keep against a station's own artifact.

**Consequence.** `pr-tipid-s3` is parked permanently. Gate checks run before the premise in
`lint-prompt.mjs`, so its premise is never evaluated at all, whatever the state of the work: it can
never surface as SPENT, never as a CANDIDATE, never as anything a reader can act on.

**Falsifying probe, so this finding cannot outlive its own truth:**
`git grep -l -I --fixed-strings STEP-11C-DONE origin/main -- docs/pr-prompts/` — if it ever returns
`pr-rates-s11c-drop-legacy-tables-HOLD.md`, this finding is dead.

**Fix (report only — 04 never edits the prompt under critique).** One clause in
`pr-rates-s11c-drop-legacy-tables-HOLD.md`: on success write
`docs/data-model/rates-migration/STEP-11C-DONE.md` carrying the literal token
`ESTIMATE_WASTE_RATES_DROPPED` on a line of its own — the shape 11A and 11B already use, and the
one the BACKLOG's own rule asks for (*"a landed-marker should carry a verify-line the next slice
can grep, not just the word 'landed'"*). Its `done_when` should then assert the marker exists, or
the same gap reopens at the next slice.

**DISPOSITION: DISPATCHED → Station 00**, to route to the owner of the rates-11c chain (06 PR
Master). 04 is read-only on the board, and the ADVERSARIAL PROMPT CRITIQUE rule forbids it from
patching another station's prompt.

### F2 — S3 — A prompt gates on a receipt its predecessor is not scoped to write

`pr-tipid-s3` also waits on `docs/audits/waste-map-location-backfill.md :: BACKFILL_UNMATCHED_ZERO`.
[MEASURED] The producer `pr-tipid-s2-write-the-ids-backfill-and-admin-HOLD.md` does instruct it, in
prose — line 64: *"On `--apply`, write a tracked receipt to
`docs/audits/waste-map-location-backfill.md`"*; line 66: *"only when `unmatched` is exactly 0 — the
literal token `BACKFILL_UNMATCHED_ZERO` on a line of its own"*. But that path appears in **neither**
its `scope:` (four entries: the backfill script, `map-locations.service.ts`, its spec,
`package.json`) **nor** its `done_when` (the script is tracked, `package.json` names it,
`pnpm build`, `pnpm lint`).

Because `scope:` is advisory (measured above), this is **not** a second dead gate — s2 can still
write the file. It is the ADVERSARIAL-CRITIQUE *missed entry in `scope`* defect with a real
consequence: `done_when` cannot prove the receipt was written, so s2 can pass its own completion
test having skipped the one output its successor's gate depends on. s3 would then sit
`GATE_NOT_RELEASED` with nothing in either prompt explaining why.

**Fix (report only):** add `docs/audits/waste-map-location-backfill.md` to s2's `scope:`, and add
`grep -q BACKFILL_UNMATCHED docs/audits/waste-map-location-backfill.md` to its `done_when`.

**DISPOSITION: DISPATCHED → Station 00**, to route to the chain owner with F1 — same chain, same
shape, one edit.

### F3 — S3 — Five prompts, two of them destructive, wait on approval files no document asks Marco for

[MEASURED] Five `-HOLD` prompts are gated on a `docs/approvals/<slug>-approved-by-marco.md` that
does not exist: `pr-524-rates-b-slice2-canonical`, `pr-rates-s11c-drop-legacy-tables`,
`pr-retire-tenderclientnote-s2`, `pr-siteid-notnull-backfill`,
`pr-tenant-mt4-s2-ownership-migration`. The mechanism is sound and has a working precedent
(`docs/approvals/README.md` + `watcher-identity-approved-by-marco.md`), and gating an irreversible
table drop on a file only Marco can write is exactly right.

What is missing is the other half: **nothing tells Marco the queue is waiting on him.** The five
gates are named only inside the five prompt files. DOCTRINE, PROMPT-SCHEMA, `sot/README.md`,
`sot/05` and `00-supervisor.md` are all silent on `docs/approvals` (measured). A gate whose release
condition is a human act nobody has been asked to perform is indistinguishable, from the board's
side, from a chain that is simply not ready — which is how five prompts sit still and read as
healthy.

**DISPOSITION: DEFERRED.** Nothing is blocked *today*: `pr-rates-s11c` is also gated on the
rates-11b2-c parity proof, and the BACKLOG records both. **What would make it urgent:** the moment
the parity proof lands, `pr-rates-s11c-drop-legacy-tables` is waiting on Marco alone, and so is
everything behind it — including `pr-tipid-s3`, once F1 is fixed. At that point it becomes a
one-question escalation for 00 to carry: *"five approvals are outstanding; here they are in one
list, with what each authorises."* Filing it now so the trigger is written down before it fires.

## WHAT I DID NOT DO

- **Did not re-file the duplicate-PR or dark-launch-log findings.** Both were already measured and
  dispositioned by Station 00 at 09:30Z (F9) and 10:08Z, minutes before this run began. They are
  recorded above as corroboration only. Re-filing a known finding is the failure the station brief
  names in its own five-angle protocol (angle 4, history).
- **Did not touch #1703 / #1704 / #1705.** Closing two duplicates is a board mutation; 04 is
  read-only, and all three hand-classify as Marco's under §10.1 step 2.
- **Did not edit `pr-rates-s11c-drop-legacy-tables-HOLD.md`, `pr-tipid-s2` or `pr-tipid-s3`.** The
  report-not-run rule is absolute: a silent auto-fix poisons the design review it exists to enable.
- **Did not stage a prompt this run.** F1 and F2 are one-clause edits to *existing* prompts, which
  is exactly what 04 may not author; a new prompt would duplicate them.
- **Did not run the Part 1 GitHub reconciliation audit or the Part 2 live-site visual patrol.** The
  station contract's one-named-sweep rule governs, and the rotation called gate-liveness. Part 0
  (a) was run anyway because the brief marks it ALWAYS; sub-checks (b)–(f) were not.
- **Did not clear any `[STALE]` line** in the sweep's section 5, including the sixteen against
  `agent-authored-rule-2-clearance-2026-09-04.md`. Not mine, and the standing rule holds: no agent
  authors or clears a RULE 2 clearance.
- **Did not touch `C:\po-vg`** — the sweep reports it holding 1 uncommitted file, age 3018 min. It
  is named in an existing needs-marco file and pruning it is 03's.
- **Did not restart, kill or diagnose the watcher process.** `restart-watcher-if-wedged.ps1`
  mutates and is not 04's script; the crash loop is already with 03.
- No Azure / Entra / SharePoint contact of any kind.
