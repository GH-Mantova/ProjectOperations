# Station 04 — Scanner | 2026-09-07T18:10:33Z–2026-09-07T18:26Z

## GROUND

```
UTC            2026-09-07T18:10:33Z
origin/main    62eab8af            (fetched, then rev-parse)
dev tree       main @ 62eab8af     C:\ProjectOperations2
doc version    1
bootstrap      1
```

Versions agree — full authority run. Sweep this run: **gate-liveness** (rotation position 1 of 4,
selected by `node scripts/pipeline/next-sweep.mjs`, not by choice).

## WHAT I MEASURED

**Reachability.** [MEASURED] `start_process` shell `powershell.exe` → PID 34712. **SIGHTED run.**
Device-bridge git guard installed first, per PREFLIGHT:
`bash "$HOME/mnt/ProjectOperations2/scripts/pipeline/vm-git-guard.sh"` → last line
`vm-git-guard installed at /sessions/dreamy-happy-cannon/.local/bin/git - refuses mounted paths,
allows everything else (both controls passed)`.

**Binding docs read from the dev tree, freshness proved by numstat, not by a piped hash** (§9.1):
`git diff --numstat origin/main -- docs/pipeline/stations/04-scanner.md docs/pipeline/DOCTRINE.md
docs/pipeline/STATION-CAPABILITIES.md` → **EMPTY**, so the working copies I read are byte-identical
to `origin/main`. DOCTRINE read in full (1638 lines, five chunks).

**Board.** [MEASURED] `status-sweep.ps1`, captured to a file because it returns early and hides its
own verdict. Section 0 controls PASS (gh reached GitHub, node runs). Section 7 verdict:
**SAFE TO ACT**. 4 open PRs — `#1777` CLEAN 15/0/0 green; `#1775`, `#1774`, `#1767` all
13 pass / 2 fail. main CI on `62eab8af` 4 success / 0 failed. `armed: 0`.

**Gate liveness, the assigned sweep — every gate on the board, four instruments.**

[MEASURED] `triage-holds.ps1` at `62eab8af`, both mandated controls PASS (GIT control: read
`origin/main:docs/pipeline/DOCTRINE.md`, 125,867 chars; SPENT control: fixture emitted exit 3, so
the SPENT bucket is reachable and a zero means none):

```
45 *-HOLD.md at depth 1
SPENT (exit 3)                 = 0
GATES SATISFIED / ADMIT (0)    = 17
STILL GATED (exit 1)           = 28
SPENT BEHIND A REJECT          = 0   (all 28 re-probed directly)
```

**`requires_merged` — 4 gates, none dead.** [MEASURED] per-PR via `gh pr view <n> --json
number,state,mergedAt` (never a list response — §9.4): `#1361` MERGED 08-28T01:15:21Z · `#1317`
MERGED 08-25T21:50:28Z · `#1257` MERGED 08-20T09:07:50Z · `#1111` MERGED 08-14T01:56:06Z. All four
released; each holder's lint verdict is consistent with that.

**`requires_file_on_main` — 7 gates.** [MEASURED] `git rev-parse origin/main:<path>`. All 7 ABSENT.
Five are `docs/approvals/*-approved-by-marco.md` — Marco-gated by design, correctly closed. Two are
code files, each with a producer prompt on the board. POS control `docs/pipeline/DOCTRINE.md`
PRESENT; NEG control a minted path ABSENT.

**`requires_on_main` — 21 entries across 18 prompts.** [MEASURED] per entry against the
`origin/main` blob: **13 released · 6 file-absent · 2 symbol-missing**. Every reading is consistent
with that prompt's lint verdict — no gate is masking a premise behind it. POS control
`blob(DOCTRINE.md)` 122,865 chars and symbol found; NEG control minted blob NULL, minted symbol
false.

⚠️ **Instrument note, self-inflicted and caught by control.** My first extraction pass read
`requires_on_main` as a scalar only and reported **18** entries. The field is a YAML list on several
prompts, so the scalar form silently truncated each to its first item. The list-aware parse returns
**21**. Same shape as §9.2's `ls-tree` depth trap: a well-formed number that was never counting what
I thought. The 21 is the measured figure; 18 was wrong.

**Duplicate cross-check (DOCTRINE §10.6, corrected form).** 17 ADMIT prompts × 4 open PRs,
directory-form scope entries matched as prefixes, any overlap ≥1 taken as a CANDIDATE and never as a
verdict. POS controls: scope parsed 17 of 17; a PR's own first file matches itself. NEG control: a
minted path matches nothing. **6 candidates**, then confirmed on each prompt's own executable
premise against the open PR's diff:

| ADMIT prompt | overlap | open PR | premise satisfied by that PR? | verdict |
|---|---|---|---|---|
| `pr-brandtheme-s2-hex-ratchet` | 4/4 | `#1774` | YES — adds `docs/qa/hex-baseline.json` | **TRUE duplicate** |
| `pr-tr-s1-reminder-policy` | 7/9 | `#1767` | YES — adds `reminders/reminder-policy.service.ts` | **TRUE duplicate** |
| `pr-tipid-s2-write-the-ids-backfill-and-admin` | 4/4 | `#1775` | YES — adds `backfill-waste-map-location-ids.mjs` | **TRUE duplicate** |
| `pr-ci-gate-dead-queue-dir-reads` | 1/2 | `#1774` | no — `check-queue-dirs` absent from diff | false positive |
| `pr-fv2-maintenance-usage-intervals` | 1/5 | `#1767` | no — `intervalUsage` absent from diff | false positive |
| `pr-sor-s9a-register-api` | 1/7 | `#1767` | no — `agreed-record-register.service.ts` absent | false positive |

POS control on the diff reads: `#1774` contains `diff --git` → true. NEG control: minted needle → false.

**A dead-gate hypothesis I raised and then REFUTED by measurement.**
`pr-tipid-s3-...-HOLD.md` carries `requires_on_main: - scripts/rates/backfill-waste-map-location-ids.mjs :: NO MATCH`.
`NO MATCH` reads exactly like an authoring artifact — the text a failed grep prints, pasted where a
marker belongs — and its two sibling entries use real markers (`BACKFILL_UNMATCHED_ZERO`,
`ESTIMATE_WASTE_RATES_DROPPED`). The available conclusion was *"a permanently dead gate, masked by
two upstream blockers"*. [MEASURED] against the diff of `#1775`, the PR that creates that very file:
`NO MATCH` occurs **4 times**, all four inside
`b/scripts/rates/backfill-waste-map-location-ids.mjs`, as an emitted report token
(`? "NO MATCH"`, `? "NO MATCH (ambiguous)"`). POS control `mapLocationId` → 50; NEG control minted
needle → 0. **The gate is live and correctly authored.** Recorded because the wrong version of this
would have retired a working gate on a plausible reading of its own text.

## WHAT CHANGED

Nothing on the board. This station is read-only on it: nothing armed, disarmed, renamed, moved,
merged, labelled or staged; no PR opened; no tracked file committed.

One deliberate working-tree change, which the station doc requires and forbids me to commit:
`node scripts/pipeline/next-sweep.mjs --advance --utc 2026-09-07T18:11:45Z` →
`advanced: last_index=0 last_run_utc=2026-09-07T18:11:45Z`. Verified by
`git diff --numstat origin/main -- docs/pipeline/sweep-rotation.json`: **EMPTY before, `2 2` after**
(§9.2's rule that numstat against `origin/main`, not `git status`, is the uncommitted-work probe).
`git diff --cached --name-status` → empty, so no other chat's work is staged alongside it.

**`docs/pipeline/sweep-rotation.json` is left dirty and uncommitted in the dev tree. Station 00 must
commit it with the next board PR** — if it is not committed the rotation stops turning and the next
run repeats gate-liveness.

## FINDINGS

**F1 — Three of the seventeen ADMIT candidates are duplicates of PRs that are open right now.**
`pr-brandtheme-s2-hex-ratchet-HOLD` (`#1774`), `pr-tr-s1-reminder-policy-HOLD` (`#1767`) and
`pr-tipid-s2-write-the-ids-backfill-and-admin-HOLD` (`#1775`). Each open PR creates the exact
artifact its prompt's premise tests for, so the premise stays TRUE and the prompt reads ADMIT for
the whole time the PR waits — which is §10.6's mechanism precisely, three live instances at once on
a four-PR board. Arming any of them opens a second PR for work already open. Two carry an extra
reason to refuse independently of this (`tr-s1` is `gate_allow: migrations`, already on the standing
never-arm list; `tipid-s2` is `escalates: true`), but `brandtheme-s2` has no other guard and sits in
the bucket an arming decision reads first.
**DISPOSITION: DISPATCHED → Station 00.** These three are not armable until their PRs settle. On
merge all three premises die and they become SPENT and retirable to `superseded/`; if a PR is closed
unmerged the prompt is live again. Nothing to do until then, and nothing for me to do at all —
arming and retiring are both 00's.

**F2 — The three false positives reproduce §10.6's documented precision failure exactly, on this
board, today.** All three overlap on a single shared file — `.github/workflows/ci.yml` once,
`apps/api/prisma/schema.prisma` twice — and all three are unrelated work. That is the
"precision is zero by construction for a one-file scope" case the 2026-09-07T02:1xZ correction
recorded against `status-sweep.ps1`; the shared file has changed, the mechanism has not. The
corrected rule handled it correctly: overlap flagged as a candidate, premise settled it.
**DISPOSITION: ACTIONED.** No document change needed — §10.6 already predicts this and prescribes
the premise as the discriminator, which is what resolved all three. Recorded as a second measured
instance so the next reader sees the rule working rather than re-deriving it.

**F3 — The three-prompt `fv2` forms chain is parked on an authoring gap, not on board state.**
[MEASURED] `pr-fv2-ai-import-HOLD` produces `apps/api/src/modules/forms/ai-form-import.service.ts`
(its own premise, scope and `done_when` all name it) and is REJECTed
`[UI_PROMPT_NEEDS_DESIGN_REF]`. `pr-fv2-ai-digests-HOLD` gates on that file and produces
`form-digests.service.ts`; `pr-fv2-output-channels-HOLD` gates on *that*. Both downstream gates are
healthy and correctly closed — but neither can ever open, because the head of the chain cannot pass
lint until someone adds a design reference, and no board state will supply one. Three prompts,
zero of them reachable, and the two `[FILE_GATE_NOT_RELEASED]` verdicts read as ordinary waiting.
**DISPOSITION: DISPATCHED → Station 06.** Staging and prompt authorship are 06's lane; I am
forbidden to edit a prompt under critique. 06 either adds the design ref to `pr-fv2-ai-import` or
takes the interface question to Marco under §10.4, which says a design question found in a prompt is
settled before arming, not inside the slice.

**F4 — Every gate on the board is alive; the answer to this sweep is a clean bill, and it is
measured rather than quiet.** 45 HOLD premises evaluated, 0 spent, 0 spent-behind-a-reject; 4
`requires_merged` all pointing at merged PRs; 7 `requires_file_on_main` all correctly closed with
producers or Marco identified for each; 21 `requires_on_main` entries all consistent with their
holders' lint verdicts. No gate is masking a premise behind it. Both of `triage-holds.ps1`'s
mandated controls passed, so `spent=0` means none rather than *"this instrument cannot say"*.
**DISPOSITION: ACTIONED.** Sweep complete and rotation advanced; nothing to repair.

**F5 — A gate symbol that reads like an error string can be a real marker, and the check is the
producing diff.** Full evidence under WHAT I MEASURED. The generalisable rule: before calling a
`requires_on_main` symbol dead, grep the diff of whatever PR or prompt creates the named file. Text
that looks like tooling output — `NO MATCH`, `not found`, `0 rows` — is a plausible deliberate
report token, and the cost of getting it wrong is retiring a working gate on the strength of how its
own text reads.
**DISPOSITION: DEFERRED.** Real, and one instance is too thin for DOCTRINE §9.5 — that section is
inside a hash-gated canonical block and a re-record costs a cross-doc change. It becomes urgent if a
second instance appears, or if any run is ever measured proposing retirement of a gate on symbol
appearance alone; at that point it is one bullet in §9.5 next to the anchor-by-symbol rule it
belongs beside.

## WHAT I DID NOT DO

- **Merged, armed, labelled or staged nothing.** 04 is read-only on the board and did not reach for
  a mutation. The `SAFE TO ACT` verdict licenses a git write; it does not widen my lane.
- **Did not commit `sweep-rotation.json`**, though I changed it. The dev tree is on `main` and 04's
  authority row is *Create a PR: NO*. Named above for 00 instead.
- **Did not run the RULE 2 `marco:true` probe or classify the four open PRs by lane.** That probe
  exists to decide a merge, and I merge nothing; running it would produce a lane verdict with a
  short shelf life that a later reader could mistake for a clearance. `#1775`, `#1774` and `#1767`
  are red and `#1777` is Marco's by the 17:1xZ board reading — all four are 00's call.
- **Did not touch the three duplicate prompts in F1.** Retiring a prompt is a board mutation, and
  they are not spent yet — their PRs are open, so the premises are correctly still true.
- **Did not edit `pr-fv2-ai-import-HOLD` to add the design ref.** The adversarial-critique pass is
  report-not-run: 04 flags a prompt's design, never rewrites it.
- **Did not run Part 0 static audit, Part 1 GitHub reconciliation or the Part 2 live-site visual
  pass.** The station doc's standing instruction is one named sweep per run, covered completely,
  rotated by `next-sweep.mjs` — gate-liveness this run. A shallow pass across all of them is the
  failure that rule exists to prevent.
- **Did not touch Azure, Entra or SharePoint**, `/sot/`, the watcher clone, or the orphaned
  worktree `C:/po-vg` (4938 min old, 1 uncommitted file) that the sweep reports — that one is 03's,
  and it holds work that `--force` would discard.

---

**This breadcrumb is UNTRACKED in the dev tree until a board PR commits it.** Station 00 collects.
Also uncommitted and needing the same PR: `docs/pipeline/sweep-rotation.json`.
