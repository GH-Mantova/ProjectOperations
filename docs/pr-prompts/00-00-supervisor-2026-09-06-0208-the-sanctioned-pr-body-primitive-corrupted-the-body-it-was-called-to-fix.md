# Station 00 — Supervisor | 2026-09-06T02:08:30Z–2026-09-06T02:30Z

## GROUND

```
UTC            2026-09-06T02:08:30Z
origin/main    90a32d95            (git fetch origin --prune, then git rev-parse --short origin/main)
dev tree       main @ 90a32d95      C:\ProjectOperations2   (f968f5a8 at run start, fast-forwarded)
doc version    1                    (docs/pipeline/stations/00-supervisor.md front matter)
bootstrap      1                    (station_doc_version declared by the scheduled-task file)
```

Doc version and bootstrap **AGREE** — this run was not restricted to read-only on that account.

**SIGHTED.** `start_process` shell `powershell.exe` → PID 27768 on the first attempt, after loading
the Desktop Commander schemas with a keyword `ToolSearch` (PREFLIGHT step 1: a validation error is
not blindness). The previous run, 01:08Z, was **blind**; this one was not. Saying so plainly because
a blind run and a healthy quiet run both produce "no news".

All three binding documents read **in full** this run from the dev tree, after proving the dev tree
is not stale for them: `git diff --numstat origin/main -- docs/pipeline/DOCTRINE.md
docs/pipeline/STATION-CAPABILITIES.md docs/pipeline/stations/00-supervisor.md` → **EMPTY** [MEASURED].
Empty numstat is the sound form; §9.1 forbids the piped-hash comparison.

`scripts/pipeline/status-sweep.ps1` run three times, each captured to a file so its §7 verdict could
not be lost to an early return: **02:10Z SAFE TO ACT** · **02:18Z CAUTION** (a PR touched inside 2
min) · **02:21Z SAFE TO ACT** after waiting. Every board mutation below was made inside the third
window. Section 0 instrument controls PASS both times.

## WHAT I MEASURED

### The fast-forward, and the blocker that was NOT the documented one

[MEASURED] Dev tree opened at `f968f5a8`, `origin/main` at `90a32d95`. `git merge --ff-only` refused
on `docs/data-model/metadata-catalog.json` — *"Your local changes … would be overwritten"* — while
`git diff --numstat` for that path was **EMPTY**. That is the line-ending smudge, not a content
difference. Cured with `git add --renormalize <path>`; `git diff --cached --name-status` read EMPTY
afterwards (so the renormalize staged nothing, i.e. the content really was identical), and the
fast-forward then succeeded. Read back: `HEAD` = `90a32d95` = `origin/main`.

⚠️ This is **not** the `sweep-rotation.json` case in the station doc, and not the untracked-breadcrumb
case either — both were absent at that moment. Three distinct causes now produce one error message.

### COLLECT — two breadcrumbs since my last run, both swept up in this run's PR

[MEASURED] `node scripts/pipeline/check-breadcrumb.mjs --freshness` → exit **0**, `CLEAN`,
`structure: 2 checked, 0 malformed`, and the NOTE that the 0108 breadcrumb is UNTRACKED. Freshness:

```
00  last 2026-09-06T01:08:00Z   1.1h ago  (map cadence 2h)  ok
03  last 2026-09-05T23:01:00Z   3.2h ago  (cadence 24h)     ok
04  last 2026-09-05T22:10:00Z   4.0h ago  (cadence 4h)      ok
05  last 2026-09-05T14:11:00Z  12.0h ago  (cadence 24h)     ok
02  dispatch-only — no cadence to miss
```

No station is SILENT, so no transcript read was required. **04 then filed again at 02:20:04Z**,
after that probe ran — its `…-0210-…` breadcrumb is collected and dispositioned below.

⚠️ **`ok` for 00 is still the weaker statement** (STATION-CAPABILITIES §6): the map says `'00': 2`
while the live cron is `5 * * * *`. Not re-raised — escalation #23 owns it.

### Board — five open, and by 02:27Z **zero red**

[MEASURED] `gh pr view` + `gh pr checks` per PR at 02:27:52Z:

| PR | mergeState | head | pass / fail / pending | lane | classification |
|---|---|---|---|---|---|
| **#1685** | BLOCKED | `b20182c0` | 13 / **0** / 1 | watcher | `marco:true` — RULE 2 binds |
| **#1682** | BLOCKED | `3f5d57d9` | 12 / **0** / 2 | second lane | hand-classified **Marco's** |
| **#1680** | CLEAN | `55968733` | 14 / 0 / 0 | watcher | `marco:true` — RULE 2 binds |
| **#1675** | CLEAN | `9414c796` | 9 / 0 / 0 | watcher | `marco:true` — RULE 2 binds |
| **#1667** | CLEAN | `6fd3b836` | 14 / 0 / 0 | second lane | hand-classified **Marco's** |

`main` CI on `90a32d95`: 4 success / 0 failed (trunk green). **#1662 merged at 01:52:40Z** and
**#1685 was opened at 02:00:55Z**, so the board turned over completely since 01:08Z.

### RULE 2 — live tree pinned, both controls, and the lane discriminator run separately

[MEASURED] Probe directory `C:\ProjectOperations2\docs\pr-prompts\processed` — **4,038** logs, newest
`rev-1685-ready.md.log` at `2026-09-06T02:07:20Z`, which is younger than every open PR. That AGE, not
`POS>0`, is what distinguishes it from the `C:\po-watcher\ProjectOperations\…` decoy that is stale to
2026-08-17 and passes its own positive control while clearing every PR since.

```
POSITIVE  marco.:true  over pr-*.log        →  615   (regex form; the . matches the quote)
NEGATIVE  zzQq00N20260906T0225               →    0   (minted this run — now spent, §9.6)
```

Per-PR, matching `PR #<n>` in the **body** of `pr-*.log` only (never `rev-*`, never the branch):
#1685 → 2 hits incl. `{"ok":false,"marco":true,"reason":"outside tests/ or docs/: apps/api/prisma/seed-initial-services.ts"}` ·
#1680 → 2 hits incl. `…"reason":"outside tests/ or docs/: package.json"` ·
#1675 → 1 hit, `…"reason":"timeout waiting for green checks + MERGE verdict"` ·
**#1682 → 0** · **#1667 → 0**.

[MEASURED] The lane discriminator, a **different instrument** (`watcher-launch.log`, POS control
`opened PR #` → **167**, NEG `opened PR #999999` → **0**): `opened PR #1685` → 1 · `#1680` → 1 ·
`#1675` → 1 · **`#1682` → 0** · **`#1667` → 0**. So the two zeroes are second lanes, not a broken
probe and not a PR still inside its `policy=tests-docs, waiting…` window (both were opened hours ago).

Hand-classification under §10.1 step 2, reading `NESTED_TEST_PATHS`' three forms:
**#1682** — `apps/web/src/pages/tendering/scope-cards/CuttingSection.tsx` matches none ⇒ **Marco's**.
**#1667** — `scripts/pipeline/__tests__/lint-prompt.human-gate.test.mjs` is tests, but
`scripts/pipeline/lint-prompt.mjs` matches none ⇒ **Marco's**. Neither falls under §10.1 step 3's
station-lane exception: `scripts/` is in no station's recorded authority, and
STATION-CAPABILITIES §6 says so in terms about this very file.

**`[NO LANE VERDICT — hand-classified]` for #1682 and #1667. Five open, five Marco's, none mine to merge.**

### #1685's red, root-caused from the job log

[MEASURED] `gh run view 34005369456 --job 101411435927 --log`:
`FAIL - CP-23 seed-without-migration [seed touched with no migration: apps/api/prisma/seed-initial-services.ts]`.
Everything else in that job PASSed or SKIPped, including `CP-26 do-not-merge [label absent]` — so this
was **not** the CP-26 coupling that has previously taken `PR gates` down as collateral.

[MEASURED] The seed diff is 8 lines: a `{ key: "mapLocationId", name: "Map location", dataType:
"TEXT", role: "INFO" }` column definition added to `rt-wst-t` and `rt-wst-m3`, and `mapLocationId:
null` written into every seeded cell. The prompt's own body (`git show HEAD:docs/pr-prompts/
pr-tipid-s1-…-HOLD.md`) says **"No migration. `RateRow.cells` is `Json`, so a new key is a data
change"**, "Do NOT add a Prisma migration", and "Populating it is S2's job and needs a real database".

### `seed_only` is dead metadata — 0 readers, with controls

[MEASURED] over `scripts/**/*.{mjs,ps1}`: `seed_only` → **0** · POSITIVE control `gate_allow` → **87**
· NEGATIVE control `zzQq00N20260906T0245` → **0**. `scripts/pr-watcher/index.mjs` matches
`seed_only|seedOnly|SEED-ONLY` **0** times. CP-23's only trigger is
`/^SEED-ONLY:\s*dev\b/m` against the **PR body** (`scripts/pr-gates/pr-gates.mjs`, anchor
`const seedOnlyDev =`). The front-matter field is inert.

### The primitive that broke — measured on my own mutation

[MEASURED] `Set-PrBody` (from `pipeline-lib.ps1`, the function DOCTRINE §1 names as the safe
alternative to a hand-rolled body write) round-tripped #1685's body through PowerShell 5.1 and wrote
back the mis-decoded form. Read with **node** (`gh … --json body -q .body`, buffer → utf8), the body
afterwards held **12 non-ASCII characters**: four runs of `U+00D4 U+00C7 U+00F6` where four em dashes
(`U+2014`) had been. `U+FFFD` = 0 and the `U+00E2 U+20AC` double-encode signature = 0, so no
validity check would have caught it. Repaired and verified — see finding A.

## WHAT CHANGED

**On the board:**

1. **#1685 — PR body gained a bare column-0 `SEED-ONLY: dev` line.** Read back with node:
   `/^SEED-ONLY:\s*dev\b/m` → **true**.
2. **#1685 — PR body repaired** after `Set-PrBody` corrupted it (finding A). Repaired in node with a
   **function replacer** (§9.3: never a replacement string). Read back: mojibake **0**, em dashes
   **4**, `U+FFFD` **0**, `SEED-ONLY` still col-0 true. Byte delta actual **−11** against intended
   **−12**, fully accounted for: `back === sent + "\n"` → **true** (GitHub appends one trailing
   newline). NEGATIVE control `zzQq00N20260906T0318` → absent.
3. **#1685 — `gh run rerun 34006022846 --failed`.** Read back at 02:24Z:
   `PR gates — diff checks (CP-09–13, CP-17, CP-22, CP-23)  pass  7s`. **The board's only red is gone.**
   The first rerun I issued named the superseded run `34005369456` and did nothing; the poller had
   already moved the head to `b20182c0` at 02:15:38Z. Naming the current run is what worked.
4. **This board PR** — the file moves listed below. **No merge, no label added or removed, no
   `/sot/` edit, no arm.**

**In the repo, via this PR:**

- Swept up two untracked breadcrumbs into `docs/pr-prompts/archive/`: the 01:08Z blind Station 00 run
  and Station 04's 02:10Z run. Both are fully dispositioned below, so `archive/` is their correct
  home; freshness matches by trailing path segment and is unaffected (DOCTRINE §9.5).
- `git mv` of the 00:08Z breadcrumb to `archive/` — fully dispositioned by the 01:08Z run.
- **04's F3** — committed the deletion of `pr-tipid-s1-waste-rows-can-carry-a-map-location-id-HOLD.md`,
  consumed into #1685 at 01:52:59Z.
- **04's F4** — retired three SPENT HOLDs to `docs/pr-prompts/superseded/`:
  `pr-cardui-s6-other-operational-costs`, `pr-plantdays-retire-and-drop`,
  `pr-scopecosts-s1-operational-cost-lines-api`.
- **04's hand-off** — committed `docs/pipeline/sweep-rotation.json` (advanced to `last_index=2`), which
  04's contract requires it to leave dirty for me.
- **§9.5's standing requirement** — committed `docs/pr-prompts/.arming-log.txt`, carrying the
  01:52:59Z `marco-delegated` arm. Nothing commits it on purpose; this closes the gap for now.

Built in an **isolated worktree** off `origin/main` (`C:\po-worktrees\board-0208`, clean at
`90a32d95`), never in the shared dev tree index and never in `C:\po-watcher`.

## FINDINGS

### A — [S1] `Set-PrBody`, the primitive DOCTRINE names as the safe way to write a PR body, corrupted the body it was called to fix. I did the damage. It is repaired. **ACTIONED**

DOCTRINE §1 says *"do not hand-roll board operations … every one of them already reads back"* and
lists `Set-PrBody`. §9.3 says the double-encoder is `Set-Content -Encoding UTF8` and that plain
`Set-Content` is byte-lossless **for content**. Both are true and neither covers this.

**[MEASURED], on #1685, this run.** `Get-PrBody` runs `gh pr view --json body -q .body` under
PowerShell 5.1, which decodes `gh`'s UTF-8 stdout with the console codepage. Each em dash
(`E2 80 94`) arrives as the three characters `U+00D4 U+00C7 U+00F6` (`ÔÇö`, the OEM-437 rendering).
`Set-PrBody` then writes those three characters back as UTF-8, and the mojibake is now **on GitHub**.

```
before  PowerShell length 1716 → after 1971,  DELTA 255 against an intended 243
node, after:  bytes 1972 · codepoints 1960 · U+2014 = 0 · U+FFFD = 0 · 'U+00E2 U+20AC' = 0
              12 non-ASCII chars, all of them the four ÔÇö runs
```

🔴 **Every read-back in `Set-PrBody` passed.** It proves the required marker is bare at column 0 — and
it is. It has no reason to ask *"is anything ELSE now different?"*. This is §9.3's
`String.replace()`-`$` trap in a new costume: a **fuller** result read as a correct one, caught only
by the byte-delta assertion the same section mandates. The +12 discrepancy is exactly the 12
corrupted characters, and it is the only thing that gave it away.

⚠️ **The console rendering is NOT the tell.** §9.3's *"`Get-Content` reports FALSE MOJIBAKE"* bullet
is right and it cost me a step: seeing `ÔÇö` in the console proves nothing, because that is also what
an intact em dash looks like there. **Only a node read of the bytes separates the two**, and here the
node read said the corruption was real.

🔧 **Repaired**, in node, with a function replacer (never a replacement string, §9.3), written to a
file and applied with `gh pr edit --body-file`. Read back: mojibake **0**, em dashes **4**,
`U+FFFD` **0**, marker still col-0. Delta −11 vs intended −12, and `back === sent + "\n"` is **true**,
so the one-byte gap is GitHub's trailing newline and nothing else.

🔧 **The interim rule, until the primitive is fixed: never call `Set-PrBody` on a body containing
non-ASCII.** Read the body with node, edit it in node, and apply with `gh pr edit --body-file`. The
permanent fix is one line in `Get-PrBody` — read `gh`'s output as bytes and decode UTF-8 explicitly,
or shell it through node — which is a `scripts/` change. See finding C for why that is stuck.

**ACTIONED** — the damage is measured, repaired, and read back. **Re-open condition:** any station
finding a `Ô`/`Ç`/`ö` run in a PR body, which is now a signature to grep for.

### B — [S2] #1685's only red was CP-23, and the truthful cure was the marker, not a migration. **ACTIONED**

The gate offers two remedies and DOCTRINE §8.2 forbids the wrong one by name (*"no GATE-ALLOW /
SEED-ONLY marker that is not actually true"*). I checked which is true rather than which is cheap:

- `RateRow.cells` is a `Json` column, so the added key is a **data** change with no schema to migrate.
- Every seeded cell gets `mapLocationId: null`. A production row that lacks the key behaves
  identically to one carrying `null` — the PR's own resolver returns
  `{ name: cells.facility, dangling: false }` in both cases.
- The prompt says in terms: no migration, and populating the field is S2's work against a real
  database.

So the marker is **honest**: the change genuinely does not need to reach production. RULE 1 — this is
the complete-and-additive option: it unblocks now, it is permanent (S2 brings its own migration when
there is real data), and it writes nothing to any database. The alternative, an idempotent migration
today, fails the *without damaging future data entry* half: it would write a column onto production
`RateRow.cells` that nothing can populate until S2, and the prompt forbids it outright.

Marker applied at column 0; `PR gates` re-run and now **pass**. **ACTIONED.** #1685 is green but
**stays for Marco** — its watcher verdict is `marco:true` and RULE 2 is not cleared by green.

### C — [S2] `seed_only` in `PROMPT-SCHEMA.md` is read by nothing, so a prompt that touches a seed and forbids a migration is **guaranteed** to fail CI, and the linter admits it. **ESCALATED**

[MEASURED] with controls (above): **0** readers in `scripts/`, against POSITIVE `gate_allow` = **87**.
`pr-tipid-s1` carried `seed_only: false` — the template default — plus prose saying "No migration".
Those two are unsatisfiable together, `lint-prompt.mjs` returned ADMIT, the watcher built it, and the
PR opened red on a gate nobody could have passed without a human editing the body afterwards. **This
will recur for every future seed-touching prompt**, and it costs a full CI cycle each time.

🔧 The fix is small and lives in three places, none of which a scheduled Station 00 can merge:
`lint-prompt.mjs` should REJECT a prompt whose `scope:` includes `prisma/seed-*.ts` with neither
`seed_only: true` nor a `migrations/` path; and the watcher should write `SEED-ONLY: dev` into the PR
body when `seed_only: true`. Both are `scripts/`.

🔴 **The escalation is not the fix — it is that the fixes have nowhere to go.** This run and Station
04's have now produced **four** measured `scripts/` defects with a named one-line cure and no lane
that can land them: this one, `status-sweep.ps1` §5 (finding E), `check-breadcrumb.mjs`'s `CADENCE`
map (already #23), and `Get-PrBody`'s decode (finding A). #1667 — itself a two-line `scripts/` fix —
has sat open and green since 2026-09-05T14:17Z for the same reason. **The question for Marco, with
RULE 1 ordering:**

**(a)** Widen Station 00's recorded lane to `scripts/pipeline/**` + `scripts/pr-gates/**`, gated in CI
the way CP-24 gates 05's `sot/` lane, so a measured one-line instrument fix can be landed by the
station that measured it. *Complete* — it fixes the backlog now and every future instance — and
*additive*: it adds a lane and a gate and removes none, touches no data, and leaves `do-not-merge`,
CP-26 and every watcher `marco:true` verdict binding exactly as they are.
**(b)** Keep the lane as it is and merge the queue yourself. Fails the *immediate* half — the four
above wait on you — and fails the *future* half, because the rate is now about one per station run.
**(c)** Do nothing. Fails both halves; the instruments that lie keep lying, and #23 is the case where
that costs a missed run nobody sees.

### D — [S2] The auto-update poller rebased #1685 four minutes before I read it, and the fix for it is still unpushed at 42 h. **ESCALATED (already filed ×2 — not re-filed)**

[MEASURED] `#1685`'s head moved to `b20182c0` and CI re-ran as run `34006022846`, created
`2026-09-06T02:15:38Z`. My first `gh run rerun` named the run that rebase had superseded and silently
did nothing — **the churn cost me one wasted instrument call and would have cost a wrong "the fix did
not work" conclusion had I not re-read the check list.** `PR_WATCHER_AUTO_UPDATE` is `"true"` against
a documented default of OFF.

The fix exists and has never left the machine: `C:\po-vg`, branch `fix/no-rebase-while-checks-run` at
`23c91ba9`, *"fix(pr-watcher): never rebase a PR whose checks are still running"*, with an 88-line
guard test — **exactly the case that bit this run.** Station 04 confirmed at 02:11Z that the branch is
still absent from `git ls-remote --heads origin`. Age now **~42 h**.

Filed at `needs-marco/po-vg-holds-the-unpushed-fix-for-an-open-escalation-2026-09-05.md` and
`needs-marco/hourly-board-pr-rebases-every-waiting-pr-2026-09-03.md`. **Not re-filed** — pushing
another actor's unpushed branch and pruning a worktree holding uncommitted work are both
irreversible-adjacent and Marco's. **I did not touch `C:\po-vg`.** Re-open/close condition unchanged:
`23c91ba9` reaching `origin`, or `PR_WATCHER_AUTO_UPDATE` set to its documented default.

### E — [S2] `status-sweep.ps1` §5 reads CLOSED as MERGED and orders the reader to delete the escalations whose subject is a closed-unmerged PR. **DEFERRED** (04's F1, carried with its cause confirmed)

Station 04 measured it and dispatched it to me; I confirm the two `[STALE]` lines are still printed by
my own 02:21Z sweep, verbatim, for `pr-1612-closed-unmerged-branch-holds-the-only-copy-2026-09-05.md`
and `remote-branches-outlive-their-prs-2026-09-05.md`. 04's shape of the fix is right and I adopt it:
§5 already holds the state string, so it needs a **third** verdict — MERGED ⇒ `[STALE] … clear it`;
**CLOSED-unmerged ⇒ `[LIVE]`, and name the branch as the thing to check**; OPEN ⇒ unchanged.

**DEFERRED, not dispatched onward.** `status-sweep.ps1` is `scripts/` — finding C's problem exactly,
and dispatching it to Station 06 would be a dispatch to a station with no schedule and no consumer,
which is the 21:08Z run's own recorded lesson. It goes to Marco as part of C's option (a).
**Nothing is cleared on the strength of those two lines**, and no station should clear them.
**What would make it urgent:** any run acting on a §5 `[STALE]` line by deleting an escalation file.

### F — [S3] Three remote heads have no open PR, none is on `main`, and the only staged hygiene work is explicitly local-only. **ESCALATED** (04's F2, carried)

`feat/crm-account360-v2-s1` (#1612, closed unmerged, 2 commits not on main), `fix/classify-policy-nested-tests`
(#1571, closed unmerged — its work reached `main` by another route), and `fix1483` (no PR ever, 28
commits, 4 of its 8 files superseded by merged #1646/#1651). `pr-hygiene-s1-guarded-branch-prune-HOLD.md`
says in terms *"Do NOT delete remote branches, ever."*

**ESCALATED**, unchanged from 04's framing, because branch deletion is irreversible (DOCTRINE §5.4) and
whether the prune gains a remote arm at all is Marco's call. RULE 1's complete-and-additive reading is
a **dry-run-by-default report** of remote heads with no open PR and a named superseding commit — it
adds visibility and destroys nothing. Deleting remote refs unattended fails the *without damaging*
half outright and is not proposed. Already filed at
`needs-marco/remote-branches-outlive-their-prs-2026-09-05.md` — which is one of the two files finding E
says the sweep is telling readers to delete.

### G — 🟢 The blindness/`Prisma-Local` correlation has its **counter-example**, and it is this run. **ACTIONED — the escalation's own named diagnostic is refuted**

`needs-marco/station-00-blindness-desktop-commander-connect-timeout-2026-09-01.md` proposes one cheap
diagnostic: *"when a station reports blindness, check whether `Prisma-Local` failed in the same run.
If the two always fall together, the fix is one fix, not two."* The 01:08Z run recorded that the
correlation had **no counter-example on record** and named the falsifier: *a run that is blind while
`Prisma-Local` connects, or one where `Prisma-Local` fails while Desktop Commander is fine.*

[MEASURED] **This run is the second of those.** Desktop Commander connected on the first attempt
(PID 27768, whole run sighted) while the same session's MCP report carried
`plugin:prisma:Prisma-Local (CONNECTION_CLOSED): "Connection closed"`. **The two local stdio servers
did NOT fall together.**

So the "one fix, not two" hypothesis is **dead**, and that is worth more than another blind-run tally:
it removes the cheapest explanation and says the blindness needs its own diagnosis. The escalation
itself stays open and stays Marco's — the connect timeout lives in client/plugin config on his
machine — but this specific line of enquiry should not be pursued further.

**ACTIONED** (the question the escalation asked is answered). **Re-open condition:** a run that is
blind while `Prisma-Local` connects would say the correlation is real in the other direction; nothing
here rules that out, only the conjunction.

### H — [S3] Five open, five Marco's, no sixth — and this time the sixth appeared and still classified to Marco. **DEFERRED**

The 01:08Z run deferred this with a two-limb re-open condition: *any of the five changing state, or a
sixth PR that hand-classifies away from Marco.* **The first limb fired and the second did not.**
#1662 merged at 01:52:40Z, #1685 opened at 02:00:55Z — the board turned over — and #1685 arrived with
a live watcher `marco:true` verdict written six minutes after it opened. So the count is unchanged and
so is the conclusion: **nothing on this board is mine to merge.**

Also closed this run: 0108's finding C, the #1682 dispatch. **[MEASURED] #1682's head moved
`0938ddf5 → 3f5d57d9` at 02:23:21Z and it is now 12 pass / 0 fail / 2 pending — its own lane took the
dispatch up.** The dispatch had a consumer after all; no re-open.

**DEFERRED**, re-open condition unchanged and now stated with its worked negative: a sixth PR that
hand-classifies **away** from Marco. #1685 was a sixth PR and was not one.

### I — [S4] The watcher clone holds 66 stashes, flat for three days. **DEFERRED** (04's F5, carried unchanged)

`git stash drop` is irreversible and nothing here is for an agent. The flatness is itself a reading —
no watcher restart since 2026-09-03, consistent with pid 20000 being long-lived. **What would make it
urgent:** the count climbing again (a restart loop), or the clone's `dirty=4` growing into something
a preflight stash would swallow.

### J — [S3] `check-breadcrumb.mjs` REJECTs a breadcrumb that is merely being written. **DEFERRED** (carried; a third clean pass this run)

[MEASURED] `structure: 2 checked, 0 malformed` at 02:12Z, and 04's own run validated cleanly at 02:20Z
minutes after writing its file. The 01:08Z run could contribute no data point (blind). The defect
remains intermittent rather than gone, wants an mtime-versus-now check, and is `scripts/` — finding C.
**Re-open condition unchanged:** a second occurrence, or any run that dispositions a station as
malformed on this cause.

## WHAT I DID NOT DO

- **Did not merge anything.** All five open PRs classify to Marco — three by live watcher `marco:true`
  verdict, two by hand-classification under §10.1 step 2. `Assert-SmokedOrEscalate` was never reached
  because no candidate exists. #1685 being green does not clear its verdict, and #1675's provably-weak
  timeout reason does not clear its verdict either.
- **Did not remove or add a label**, did not author a `merge-approvals/` file or any approval receipt,
  and did not clear a watcher verdict. No agent may author an approval file, and removing
  `do-not-merge` does not clear RULE 2.
- **Did not arm anything.** Armed was 0 at 02:10Z and 0 at 02:30Z, counted by listing the queue root.
  The 38-prompt gates-satisfied bucket is a list of candidates, not instructions. Three named prompts
  stay on the never-arm list and `pr-watcher-verdict-home-resolver-HOLD.md` stays **staged, not armed,
  ask Marco first** — it touches the watcher's merge gate.
- **Did not push to #1685's branch.** The CP-23 cure is a PR-body edit; the code is its lane's.
- **Did not push to #1682's branch** and did not apply `.first()` to mask its ambiguity. Its lane
  fixed it itself at 02:23Z.
- **Did not touch `C:\po-vg`**, its worktree or its unpushed branch (finding D), and did not delete,
  prune or drop any branch, stash or remote ref (finding F). All irreversible, all Marco's.
- **Did not commit from the shared dev-tree index.** Everything in this PR was staged in an isolated
  worktree off `origin/main`; the dev tree's index was read (`git diff --cached --name-status` → EMPTY)
  and left alone.
- **Did not commit the ~30 untracked files in `docs/pr-reviews/`.** That is the three-homes verdict
  defect already landed on `main` in #1683; four runs have now re-derived it and a fifth would be
  waste. It is a real gap — those verdicts exist in one home only — but it wants the staged
  `pr-watcher-verdict-home-resolver-HOLD.md`, which is `scripts/` and unarmed on purpose.
- **Did not edit DOCTRINE §9.3** to add finding A, though that is where it belongs. §9 is inside the
  hash-gated `instruments v2` canonical block; changing it means re-recording the hash and shipping
  all seven station docs in one PR, which the station doc itself says is more than a collect run
  should carry. Named here so the next `scripts/`-capable lane can carry both together.
- **Did not restart, `-Fix` or kill anything.** The sweep read watcher node RUNNING pid 20000, wrapper
  alive, heartbeat 3–4 min: HEALTHY. Nothing was wedged and nothing needed recovering.
