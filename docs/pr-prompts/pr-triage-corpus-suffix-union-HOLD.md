---
premise: '! grep -q "TRIAGE_CORPUS_UNION_V1" scripts/pipeline/triage-holds.ps1'
premise_means: >-
  triage-holds.ps1 defines its corpus by a single filename suffix - it globs "*-HOLD.md" at depth 1
  of docs/pr-prompts and nothing else. Any prompt file carrying a different suffix is outside the
  denominator, so a spent prompt sitting at the queue root is invisible to the sweep whose whole
  job is to find spent prompts, and the TOTALS line still tells its reader that "every premise on
  this board was evaluated". MEASURED 2026-09-10 by Station 04 and re-measured the same day by
  Station 00 - the marker is absent, the glob is a single suffix, and one spent -LOOPING.md file at
  depth 1 was missed by two consecutive gate-liveness runs for exactly this reason.
scope:
  - scripts/pipeline/triage-holds.ps1
done_when: grep -q "TRIAGE_CORPUS_UNION_V1" scripts/pipeline/triage-holds.ps1 && powershell -NoProfile -ExecutionPolicy Bypass -File scripts/pipeline/triage-holds.ps1
size: 1
gate_allow: none
seed_only: false
escalates: false
backfill: false
module: pipeline
---

# The triage corpus is a filename suffix, so a spent prompt can sit at the queue root unseen

## The defect, measured

`scripts/pipeline/triage-holds.ps1` builds its corpus from one glob (anchor: the assignment
`$holdFiles = @(Get-ChildItem -Path $queueDir -Filter "*-HOLD.md"`):

    $holdFiles = @(Get-ChildItem -Path $queueDir -Filter "*-HOLD.md" -File | Sort-Object Name)

Everything downstream is scoped to that array, including the published denominator (anchor: the
`=== TOTALS  spent=` write) and the explanatory line beneath it, which asserts that *every premise
on this board was evaluated*.

That sentence is true of `*-HOLD.md` and false of the board. A prompt file at depth 1 of
`docs/pr-prompts` carrying any other suffix is never opened, never linted, and never counted -
while the totals line reports a clean board to a station that is deciding what to arm.

[MEASURED] 2026-09-10 by Station 04 during the `gate-liveness` sweep, and re-measured the same day
by Station 00 at `origin/main` `d599bd46`:

| probe | reading |
|---|---|
| `triage-holds.ps1` TOTALS | `spent=0 of 41 evaluated  gates-satisfied=10  still-gated=31  unreadable=0  of 41 HOLDs` |
| `pr-watcher-verdict-home-resolver-LOOPING.md`, depth 1 of `docs/pr-prompts` | present on disk |
| `lint-prompt.mjs` on that file | **STALE, exit 3** - the work already shipped |
| `VERDICT_HOME_RESOLVER` in `origin/main:scripts/pr-watcher/index.mjs` | **6** |
| POSITIVE control `classifyPolicyFiles` in the same file | **2** |
| NEGATIVE control, a needle minted that run | **0** |

So the board's honest spent count was **1**, not 0, and the instrument could not say so. Two
consecutive gate-liveness runs rediscovered that one file by hand, a day apart.

**What is NOT claimed.** No second mis-suffixed prompt is asserted to exist today; the measured
defect is the corpus definition, not a count. The exposure from this particular file was clutter
rather than a duplicate build, because the watcher globs `*-ready.md` and would never have run it.

## Why it matters

`triage-holds.ps1` is the instrument Station 00 consults before arming. Its own output calls the
gate-satisfied list *"CANDIDATES, not instructions"*, which is the right caution about the prompts
it names - but it offers no caution at all about the prompts it never looked at. A reader who takes
`spent=0` as a statement about the queue has been told something the script did not measure, and
the sentence that reassures them is the same one that hides the corpus. That is DOCTRINE section 7's
shape: a correct reading of the wrong quantity.

## The change (complete and additive - RULE 1)

1. Widen the corpus to the union of the prompt-file suffixes actually used at depth 1 -
   `-HOLD.md`, `-ready.md` and `-LOOPING.md` - by filtering the directory listing on that set
   rather than passing one `-Filter` string. Keep `Sort-Object Name`.
2. **Exclude `rev-*` files from the union.** They are auto-generated REVIEW JOBS with no front
   matter by design (DOCTRINE section 9.5), and counting them would report them as malformed.
3. Carry the suffix through to the output so a reader can see which bucket each row came from, and
   make the TOTALS line name the corpus it measured instead of saying *"this board"*.
4. Keep the existing `-HOLD.md` sub-count on its own line, so any reader or script relying on the
   old number still finds it. Removing a number a reader may depend on is the "without damaging
   existing work" half of RULE 1.
5. Mark the new expression `TRIAGE_CORPUS_UNION_V1` in a comment so the premise above dies on
   landing and the next reader can anchor on a symbol rather than a line number (DOCTRINE
   section 9.5).

**Additive:** no prompt leaves the denominator, no verdict changes for any file already counted,
the two instrument controls at the top of the script are untouched, and a wider denominator can
only ever reveal - it cannot hide.

## Verification the change must carry

A read-back is required, not an assertion (DOCTRINE section 1). In the PR body, record:

- the TOTALS line before and after, with both the union count and the `-HOLD.md` sub-count visible;
- a POSITIVE control that the widened corpus actually reaches a non-`-HOLD` file: create a fixture
  prompt at depth 1 with a `-LOOPING.md` suffix whose premise is known-false by construction, and
  show it appearing in the SPENT bucket. Remove the fixture afterwards and say so;
- a NEGATIVE control that `rev-*` files are still excluded - they must not appear in any bucket
  and must not be reported as malformed;
- confirmation that the gate-satisfied list is unchanged for the `-HOLD.md` files, so the arming
  surface this script feeds has not moved.

If the POSITIVE control cannot be produced, do not land the change - a wider glob nobody has seen
match a new file is indistinguishable from the old one.

## Guards this is likely to trip

- The file is `scripts/`, so `classifyPolicyFiles` refuses it and the PR is Marco's at merge
  (DOCTRINE section 10.1). Expect the routing; it is correct.
- No migration, no schema, no seed, no permission code - CP-11, CP-24 and the permission registry
  are untouched.
- PS 5.1 only. Use no single-letter variables and no automatic-variable names (`$home`, `$input`,
  `$pwd`, `$args`, `$matches`), and do not put `Write-Output` inside a function whose return value
  is captured (DOCTRINE section 7 guards 5 and 6, and section 9.1).
- `Get-ChildItem` with `-Recurse` is not wanted here - this is a depth-1 listing, and DOCTRINE
  section 9.1 records that combining a trailing wildcard path with `-Recurse` and a type filter
  returns zero whenever depth 1 holds no matching file.

## Standing authority

STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.

## Provenance

Found by Station 04 on 2026-09-10 during the `gate-liveness` sweep (its finding F4), dispatched to
Station 00, and staged here by Station 00's 07:08Z collect at `origin/main` `d599bd46`. Station 04
recorded the complete-and-additive option as (a) and explicitly did not stage it, because its own
staging budget went to `pr-statussweep-gitproc-scope-to-the-two-repos`. The same file had already
been dispatched to Station 00 by the 2026-09-09T02:20Z gate-liveness run as its finding F1c.
