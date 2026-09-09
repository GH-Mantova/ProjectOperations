# A review verdict is not anchored to a head SHA. A MERGE for commit A authorises the merge of commit B.

**Raised by** Station 00, 2026-09-09
**Found via** PR #1824's MERGE verdict going stale within four minutes of being written
**Second instance in two days** — the first was PR #1823's verdict, below
**Marco's call needed on** whether to add the anchor, and whether a stale verdict should block or re-review

---

## GROUND

The watcher's review lane writes a verdict to `docs/pr-reviews/pr-<N>-review.md`, mirrors it to the
PR as a comment, and the merge path reads it back through `verdictApproves` /
`verdictTextApproves` to decide whether its own reviewer approved the PR.

Nothing in that round trip records **which commit the reviewer looked at.**

## WHAT I MEASURED

`[MEASURED]` `scripts/pr-watcher/merge-queue.mjs` — 305 lines — contains **no head-SHA awareness at
all**:

| needle | hits |
|---|---|
| `headRefOid` | 0 |
| `head_sha` | 0 |
| `headSha` | 0 |
| `sha` | 0 |
| `anchor` | 0 |
| `stale` | 0 |

**POS controls on the same instrument over the same file**, so the zeros are real absences and not a
grep that was never reading anything: `merge` = 74, `pr` = 102, `function` = 9.
**NEG control**: `zqxNoSuchNeedle` = 0.

`[MEASURED]` `scripts/pr-watcher/index.mjs` contains `headRefOid` exactly twice, and neither is
reachable from verdict handling:

- `:2576` — `const sha = pr.headRefOid ?? "";` inside `handleConflictedPr`. It is the dedupe key for
  **conflict notifications**. Read in context, this code is the thing that gets it *right*:
  `const isNewPush = entry && entry.sha !== sha;` resets the notification state when the head moves,
  precisely so a stale notification cannot stand.
- `:2689` — the string `"number,title,mergeStateStatus,headRefOid,statusCheckRollup"`, a field list
  passed to `gh pr view`. The field is fetched. Nothing downstream of the verdict reads it.

`[MEASURED]` `merge-queue.mjs` contains the token `verdict` **0** times, so verdict handling is
entirely in `index.mjs` — the grep above was pointed at the right files.

`[MEASURED]` `scripts/pr-watcher/__tests__/verdict-anchor.test.mjs` is **not** about this. Its
subject is `VERDICT_HEADING_TOLERANT_V1` — whether the verdict-reading **regex** is anchored at
column 0, after `pr-762-review.md` was missed for writing `## VERDICT: MERGE` on line 3. The word
"anchor" collides with what this escalation is about; the contract does not overlap at all. **A
reader who greps for "anchor" in the watcher tests will conclude this is already covered. It is
not.**

## THE TWO INSTANCES

### #1824, 2026-09-09 — a MERGE verdict that outlived what it approved

`[MEASURED]` Verdict written `22:28:00Z` against head `032bb631`, verdict **MERGE**, PR docs-only so
it sits in the tests-docs lane. At `22:3x` I pushed `c7c14844` to the same branch. That commit adds a
`<!-- watcher: do-not-arm -->` marker to a prompt — which flips `lint-prompt.mjs` from `ADMIT` to
`REJECT [HUMAN_GATE_PRESENT]` and therefore **changes what the arming pipeline does**. The standing
MERGE verdict covered it regardless. The reviewer had never seen it.

Nothing malfunctioned. Every component did exactly what it was written to do.

### #1823, 2026-09-08/09 — a REJECT verdict whose evidence table had expired

`[MEASURED]` The REJECT-AND-REDO verdict marked build, lint and both test suites **UNVERIFIED ("CI
cancelled")**. On the head it was judging, `API — lint, test, compliance smoke`, `Web — lint, vitest,
build` and `tendering-e2e` were all **SUCCESS**; only the CP-26 pair was red. The verdict's
*substance* — the seed-only delivery defect — was correct and load-bearing. Its *evidence table* was
describing an earlier commit.

That distinction mattered: acting on the substance was right, and acting on the evidence table would
have meant re-running green CI and possibly reading the failure as real. **Nothing in the pipeline
distinguishes the two, because nothing records which commit a verdict describes.** I only caught it
by re-reading the checks by hand.

## WHY THIS IS STRUCTURAL, NOT BAD LUCK

The failure modes are asymmetric, and the dangerous one is silent:

- **A stale REJECT** costs a human's attention and some re-verification. Visible, annoying, safe.
- **A stale MERGE arms auto-merge on unreviewed code.** The window is exactly "reviewer finishes →
  someone pushes → merge path fires", which is *routine*: a review takes minutes, a fix-up push
  after review is the normal shape of a PR, and `pollForBehindPrs` auto-updates BEHIND branches on a
  120-second timer — so **the watcher itself can move a branch's head under a standing verdict**
  without any human doing anything.

`verdict-anchor.test.mjs`'s own header states the asymmetry for the *reader*: *"A verdict this reader
misses costs a deadlocked PR and a human. A verdict this reader INVENTS arms auto-merge."* The same
sentence applies to the *anchor*, and the anchor has no test.

## PROPOSED FIX — Marco's call

Small, and the codebase already contains the pattern.

**1. Stamp the SHA when the verdict is written.** The review job knows the head it checked out. Put
it in the verdict file header, in the same fixed form the reader already tolerates, e.g.
`REVIEWED-SHA: <40 hex>` — and mirror it into the PR comment so a human reading the thread can see
which commit was judged.

**2. Refuse to act on a verdict whose SHA is not the current head.** This is
`handleConflictedPr`'s existing shape, which already gets it right:

```js
const isNewPush = entry && entry.sha !== sha;   // index.mjs:2580
```

**3. Fail closed, and say which way.** A verdict with **no** `REVIEWED-SHA` (every verdict written
before this lands) must not be treated as approval — otherwise the fix does nothing for the 107
verdicts already tracked. That means a grace path is needed, which is question 3 below.

### The three questions for Marco

1. **On a stale verdict, block or re-review?** Blocking is one line and always safe. Auto-re-queueing
   the review is what a human actually wants, but it can loop if the branch keeps moving (the
   watcher's own auto-update can move it). I lean **block + log + let Station 00 re-queue**, which is
   exactly what I did by hand on #1824 — but that only works while a supervisor is watching.
2. **Should a stale verdict on the tests-docs lane block too?** That lane is the one that can merge
   without a human, so it is where a stale MERGE does the damage — which argues for *stricter* there,
   not looser. Worth noting: this lane's merge ACTION has not fired since 2026-08-24 (filed
   separately), so today this is latent, not live. **If that lane is ever repaired, this defect goes
   live with it.** The two escalations should be read together.
3. **What happens to the 107 verdicts already tracked, which have no SHA?** Options: treat
   missing-SHA as approval for a fixed grace window; treat it as never-approval and accept that
   in-flight PRs need one re-review; or backfill nothing and only enforce for verdicts written after
   the change. Only you should pick — the middle option is safest and costs a round of re-reviews.

## WHAT I DID NOT DO

- Did **not** touch `index.mjs`, `merge-queue.mjs` or any watcher file. The watcher is live (pid
  13352) and this is its merge path; a change here belongs in its own PR with tests, after Marco
  rules on questions 1-3. Guessing at question 3 in code would be the worst outcome of the three.
- Did **not** re-raise the tests-docs merge escalation. It is filed at
  `needs-marco/tests-docs-lane-merge-action-has-not-fired-since-2026-08-24.md` and stands on its own
  measurement. This entry only notes that the two interact.
- Did **not** audit the 107 tracked verdicts for how many describe a commit that is no longer the
  head. It is measurable — each verdict's mtime against the branch's push history — but it answers a
  question nobody has asked yet, and question 3's answer may make it moot.
- Did **not** treat #1824's own MERGE verdict as approval. I posted the staleness on the PR and
  re-queued the review by hand.

## FINDINGS

- **ESCALATED** — verdicts are not anchored to a commit; a MERGE for commit A authorises commit B.
  Three questions above, all of them policy rather than mechanics.
- **ACTIONED** — #1824 protected by hand: staleness posted to the PR, review re-queued so a verdict
  exists for the actual head. This is not a fix; it is a supervisor standing where a check should be.
- **ACTIONED** — measured with POS and NEG controls on every probe, and checked that
  `verdict-anchor.test.mjs` does **not** already cover this despite its name.
- **DEFERRED** — the audit of 107 existing verdicts, pending Marco's answer to question 3.
