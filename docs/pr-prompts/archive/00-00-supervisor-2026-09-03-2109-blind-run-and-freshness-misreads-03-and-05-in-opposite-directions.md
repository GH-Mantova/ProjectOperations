# Station 00 — Supervisor | 2026-09-03T21:09Z–2026-09-03T21:15Z

🔴 **THIS WAS A BLIND RUN.** Not a quiet one. Read the GROUND block before quoting anything below.

## GROUND

```
UTC            2026-09-03T21:09:45Z
origin/main    bfd2596b   (file read of .git/refs/remotes/origin/main — NOT `rev-parse`; see below)
dev tree       main @ bfd2596b   C:\ProjectOperations2   (converged with origin/main)
doc version    1   (docs/pipeline/stations/00-supervisor.md front matter)
bootstrap      1   (scheduled-task SKILL.md)
```

Doc version and bootstrap AGREE. No read-only demotion on that ground.

🔴 **The preflight was NOT satisfied.** Step 1 failed, and the contract says that stops the run.
The four lines above were reconstructed from FILE READS of the mount, not from `git`, because a
blind run may not execute `git` against the Windows `.git` (a cut-short VM-side git call leaves the
0-byte `index.lock` that freezes every station). Treat the SHAs as file-read evidence, not as
`rev-parse` output.

## WHAT I MEASURED

**[MEASURED] Blindness is real, and it was established by the doc's OWN procedure, not by assumption.**
`00-supervisor.md` step 1 warns that a cold call to an unloaded schema is an instrument lie, not an
unreachable machine, and requires loading the schema FIRST. I did:

1. `ToolSearch "desktop-commander start_process interact_with_process read_process_output"` → no match.
2. `ToolSearch "desktop-commander"` → no match; transport reported the server as *still connecting*.
3. `ToolSearch "select:mcp__remote-devices__plugin_desktop-commander_desktop-commander__start_process,mcp__remote-devices__device_bash,mcp__remote-devices__get_device_info"`
   — the exact select form the station doc mandates → **no matching deferred tools found.**

The transport then reported, twice and unprompted:
`plugin:desktop-commander:desktop-commander (CONNECT_TIMEOUT): "MCP server ... connection timed out after 30000ms"`.
`plugin:prisma:Prisma-Local` timed out in the same way in the same window.

⇒ The schemas are absent because the SERVER never connected, not because they were unloaded.
This is escalation **#17 — STATION-00 BLINDNESS (`CONNECT_TIMEOUT`)**, recurring. Per #17's own
standing note, **06's soak is mid-flight, so this is a DATA POINT FOR THAT SOAK, not a re-escalation.**
Recording the pair (`desktop-commander` AND `Prisma-Local` timing out together, both stdio-launched
local servers) because it is the kind of correlation the soak exists to collect.

**[MEASURED] Machinery is NOT wedged.** All seven wedge markers absent from `C:\ProjectOperations2\.git`:
`index.lock`, `MERGE_HEAD`, `REBASE_HEAD`, `CHERRY_PICK_HEAD`, `rebase-merge`, `rebase-apply`, `sequencer`.

**[MEASURED] `armed = 0`.** `ls docs/pr-prompts/*-ready.md` → zero files. Consistent with the 20:09Z
run's deliberate `armed=0`. Nothing armed itself in the interval.

**[MEASURED] Loose refs and `packed-refs` DISAGREE, and only one of them is right.**
```
.git/refs/heads/main            bfd2596b42b00339b6c5949f5a7e177c89f75520
.git/refs/remotes/origin/main   bfd2596b42b00339b6c5949f5a7e177c89f75520
.git/packed-refs  heads/main            4ea28d6da44213ff9666e6f1aed154460bd33e5b
.git/packed-refs  remotes/origin/main   66194af6e50fe497ee39e0199797112941755843
```
Loose refs take precedence, so `bfd2596b` is correct and matches what the 20:09Z run recorded after
merging `#1553`. **But a blind run reading `packed-refs` — a plausible thing to reach for when `git`
is barred — gets two confidently-formatted, entirely stale SHAs with no error.** Same shape as the
RULE-2 dead-decoy trap found at 20:09Z: a wrong instrument that answers fluently.
Recorded as a method trap, below.

**[MEASURED] Breadcrumb freshness, computed BY HAND from filename stamps** (the same key
`check-breadcrumb.mjs` uses), against `CADENCE = { '00':2, '02':null, '03':24, '04':4, '05':24 }`
at `check-breadcrumb.mjs:36`, which alarms only past **2×**:

| st | age at 21:10Z | cadence | 2× | detector would say | truth |
|----|---------------|---------|-----|--------------------|-------|
| 00 | 1h02m | 2h | 4h | ok | ok (the 20:09Z run) |
| 02 | no breadcrumb found | null | — | "dispatch-only" | n/a |
| 03 | **46h09m** | 24h | 48h | **ok** | **one occurrence already missed** |
| 04 | 3h01m | 4h | 8h | ok | ok |
| 05 | **55h00m** | 24h | 48h | **SILENT** | **NOT stopped — died on a 529** |
| 06 | 14h31m | *no key at all* | — | invisible | invisible |

**[CANNOT MEASURE]** `check-breadcrumb.mjs --freshness` itself, `lint-*.mjs`, `status-sweep.ps1`,
the node/watcher process, `index.lock` in the `C:\po-watcher` clone, and the RULE-2 `marco:true`
probe — all require executing on the box. **No `breadcrumb-clean` claim is made by this run**, and
the contract forbids one until the validator has actually exited 0.

## WHAT CHANGED

**Nothing.** No arm, no disarm, no merge, no label, no dispatch to the box, no `/sot/` edit, no PR.
The single write this run made is this breadcrumb file, untracked, into the dev tree — the only
write channel a blind run has (the GitHub MCP is read-yes / write-no: `create_branch` → 403).

## FINDINGS

### FINDING 1 — The freshness detector misread 03 and 05 in OPPOSITE directions, in the same snapshot. #23 is now measured on live stations, not derived from source.

Escalation #23 has always argued from `check-breadcrumb.mjs:35-36` that alarming at `2×` **hides
exactly one missed occurrence** on a 24h station. That was a reading of the code. This run has it as
a **measurement on two live stations at once**:

- **03 reads `ok` while definitively having missed an occurrence.** Last breadcrumb
  `2026-09-01-2302`. Its cron fires 23:00:45Z daily, so the **2026-09-02T23:00Z occurrence produced
  nothing.** At 46h09m the detector is 1h51m short of `2×` and would print `ok`. The false NEGATIVE
  half of #23, exactly as predicted, on a station nobody was watching for it.
- **05 reads `SILENT` while not being stopped at all.** 55h00m, past `2×`. But the 20:09Z run crossed
  three instruments and found `lastRunAt` = 09-03T14:11:26Z with the session transcript's only
  assistant turn being `API Error: 529 Overloaded` — table row 2, *"started and died"*. The false
  POSITIVE half.

One detector, one snapshot, both failure modes visible simultaneously. This is the strongest single
piece of evidence yet for **#23 option (a)** — record each station's REAL cadence and alarm at
`1×cadence + grace` — which is the complete-and-additive option already before Marco.

🔴 **Do NOT report 05 as a stopped station.** 🔴 **Do NOT report 03 as healthy.**

**03's next fire is 2026-09-03T23:00:45Z, ~1h50m after this run ends.** The 22:09Z or 00:0xZ run MUST
check it: a breadcrumb stamped `2026-09-03-23xx` means 03 recovered from a single miss; its absence
means **two consecutive misses and 03 is genuinely stopped** — and note that even then the detector
will not say so until 09-03T23:02 + 48h.

**DISPOSITION: ESCALATED** — as new measured evidence attached to the OPEN escalation **#23**, not as
a new escalation. No new options are added; option (a) is unchanged and still Marco's call. The one
thing this adds is urgency: the false-negative half is no longer hypothetical.

### FINDING 2 — Station 00 was blind again, and `Prisma-Local` failed identically in the same window.

Blindness recurred (#17). What is new is the **correlation**: `desktop-commander` and `Prisma-Local`
— both locally-launched stdio MCP servers — returned `CONNECT_TIMEOUT` after 30000ms in the same
session, while every remote HTTP server in the session either connected or failed for unrelated auth
reasons. That is consistent with a host-side launch/startup problem rather than anything specific to
Desktop Commander, which is a distinction #17's option set does not currently draw.

**DISPOSITION: DEFERRED** — deliberately not re-escalated. #17's standing note says 06's soak is
mid-flight and forbids re-escalating on one blind run, and that rule is right. This is logged as a
soak data point. **What would make it urgent:** the soak concluding without having considered the
stdio-server correlation, or three consecutive blind 00 runs (which would stop the board rather than
merely slow it).

### FINDING 3 — `.git/packed-refs` is STILL stale, with the SAME SHA it had four days ago. This is a RE-CONFIRMATION, not a discovery, and I nearly filed it as one.

I measured `.git/packed-refs` carrying `4ea28d6d` (heads/main) and `66194af6` (remotes/origin/main)
while the loose refs carried the true `bfd2596b`. Loose wins, so nothing errored.

🔴 **I drafted this as a NEW trap. It is not.** The blind-run `packed-refs` trap was found on
**2026-08-31T22:11Z** and is standing memory, marked *keep forever*. Checking before claiming is what
caught it — and the check paid, because it turned a duplicate into a much stronger reading:

**`66194af6` is the EXACT SAME stale value the 08-31 run recorded.** That run measured
`packed-refs origin/main = 66194af6` against a loose ref of `6d19e841`. Four days and many merges
later, `packed-refs` still says `66194af6`. **The staleness is not a transient window — it is a
permanent divergence that has been growing since at least 08-31**, and every day it grows the wrong
answer gets more wrong while remaining perfectly well-formed.

🔴 **And the fix has been parked the whole time.** The 08-31 finding's disposition was
*"DEFERRED → one-line DOCTRINE §9 addendum on the next `docs/`-only arm; bank it with the
`git worktree list` addendum"*. It was re-banked again at 09-01T06:09Z. **The trigger — "the next
`docs/`-only arm" — has not fired in four days**, so the addendum has never landed and each blind run
pays to re-derive it. That is precisely the standing lesson that *a disposition addressed to a FUTURE
EVENT outlives its own fix and bills a later run to re-discover it* — and this run is the bill.

**DISPOSITION: ESCALATED** — not for the trap (it is known and correctly recorded), but for the
**parking mechanism**, attached to the existing 06-cadence / orphaned-disposition escalation rather
than opened as a new one. The concrete question that item now has a worked example for:

> A DEFERRED whose trigger is an EVENT ("the next `docs/`-only arm") and not a DATE has no deadline
> and no instrument. This one has been parked 4 days across at least 2 re-bankings.
> **(a)** Give every DEFERRED an explicit expiry date; any station's preflight prints the ones past it
> — *complete* (catches every future park, not just this one) and *additive* (a new field + a
> read-only print, blocks no PR) ⇒ **RULE-1 FIRST**.
> **(b)** Ban event-triggered DEFERRALs; require a station + a date — fails *complete*, it stops the
> mislabel but still counts nothing already parked.
> **(c)** Leave it — fails *complete* outright; this finding is the fourth day of the evidence.

⚠️ I am deliberately NOT dispatching the one-line §9 addendum to 06 as though that discharges it.
Dispatching it again, on the same trigger shape that already failed twice, would be the fourth
re-banking wearing a different hat.

## WHAT I DID NOT DO

- **No board action of any kind.** I did not triage, arm, disarm, label, merge, or classify any PR.
  Four PRs were open at 20:09Z, all four Marco's; I did not even re-read them. Establishing lane and
  RULE-2 status requires the `marco:true` probe on the box, and — per the 20:09Z finding — that probe
  has a dead decoy path that passes its own positive control. **Running a probe I cannot pin to the
  live tree is worse than not running it**, so I ran none.
- **No `status-sweep.ps1`**, so no SAFE/CAUTION verdict exists for this run. Absence of a CAUTION line
  is not a SAFE verdict.
- **No `check-breadcrumb.mjs`**, hence no `breadcrumb-clean`. The freshness table above is a by-hand
  reconstruction and is labelled as one.
- **No PR for FINDING 3.** Dispatched rather than actioned, because a blind run cannot open one.
- **No `/sot/` edit.** Not my lane, and 05 — whose lane it is — has now lost two of its last three
  occurrences, leaving `/sot/` unkept ~55h. That is already inside #23's recovery half.
