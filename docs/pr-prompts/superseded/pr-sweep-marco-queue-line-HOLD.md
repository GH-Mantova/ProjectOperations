---
premise: '! test -f scripts/pipeline/marco-queue.mjs'
premise_means: >-
  Nothing shows how many PRs are waiting on Marco or for how long, so stations decide whether to arm
  without knowing. "ARM ONE AT A TIME" (00-supervisor.md) has been credited with protecting Marco's
  queue, but it only stops two runs colliding in the dev tree: five prompts armed one at a time still
  produce five PRs that wait on the same person. Source: docs/plans/arming-throughput-brief.md
  (Station 06, #1741) and handover item 20. MEASURED 2026-10-03 at origin/main d456f342:
  status-sweep.ps1 section 1 lists open PRs with merge state and CI only. No label, no age, and no
  "waiting on Marco" count anywhere in the file.
done_when: >-
  pnpm build && pnpm lint &&
  node --test "scripts/pipeline/__tests__/*.mjs" &&
  test -f scripts/pipeline/marco-queue.mjs &&
  grep -q "MARCO_QUEUE_LINE_V1" scripts/pipeline/status-sweep.ps1 &&
  grep -q "MARCO_QUEUE_LINE_V1" docs/pipeline/stations/00-supervisor.md &&
  node scripts/pipeline/lint-station.mjs
scope:
  - scripts/pipeline/marco-queue.mjs
  - scripts/pipeline/__tests__/marco-queue.test.mjs
  - scripts/pipeline/status-sweep.ps1
  - docs/pipeline/stations/00-supervisor.md
  - docs/pipeline/stations/_canonical-blocks.json
size: 2
gate_allow: none
backfill: false
seed_only: false
rollback_strategy: >-
  A report-only script, two sweep lines and one doc paragraph. Reverting removes the lines. Nothing
  gates on them, so nothing else changes.
escalates: true
module: pipeline
---

# The status sweep shows how many PRs are waiting on Marco, and for how long

STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.

## Marco's ruling (2026-10-03)

**Show it, don't block.** The sweep reports the queue waiting on Marco. Arming stays a station's
judgement. There is **no limit and no refusal**: nothing may gate on these numbers. Tag all new code
and doc text with `MARCO_QUEUE_LINE_V1`.

**Go/no-go, check first:** `pr-board-lease` also edits `status-sweep.ps1`. If
`docs/pr-prompts/pr-board-lease-ready.md` exists, or an open PR's title contains `BOARD_LEASE_V1`,
stop with NO-OP.

## 1. `scripts/pipeline/marco-queue.mjs`: a pure function plus a thin CLI

`export function marcoQueue(prs, nowIso)` takes the array from
`gh pr list --state open --json number,isDraft,labels,createdAt` and returns:

```js
{ waiting: { count, oldest: { number, hours } | null },   // open, non-draft, labelled do-not-merge
  open:    { count, oldest: { number, hours } | null } }  // all open, non-draft
```

- `hours` is the time since `createdAt`, rounded down to a whole hour. It means "open for", not
  "waiting since". Say so in the printed text.
- Drafts are excluded from both counts.
- If the input is not an array, throw. Never return zeros for unreadable input.

The CLI is `node scripts/pipeline/marco-queue.mjs --now <iso> --file <json path>`. It prints exactly two
lines:

```
WAITING ON MARCO: 2 open PR(s) labelled do-not-merge; oldest #2218, open 5h
ALL OPEN (non-draft): 5; oldest #2218, open 5h
```

With none, print `WAITING ON MARCO: 0 open PR(s) labelled do-not-merge` (no oldest). Exit 0. If the
file is unreadable or not an array, print `[CANNOT MEASURE] <reason>` and exit 2.

## 2. `scripts/pipeline/status-sweep.ps1`, section 1 only

After the open-PR loop:

1. Fetch `gh pr list --state open --limit 50 --json number,isDraft,labels,createdAt`.
2. Write the result to a temp file with `[IO.File]::WriteAllText` and UTF8 without BOM.
3. Run the CLI with `--now $nowUtc`.
4. Print each output line with `Line "LIVE" ...`.
5. If the CLI exits 2 or gh fails, print `Line "LIVE" "WAITING ON MARCO: [CANNOT MEASURE] ..."`.
   Never print a zero.
6. Delete the temp file.

**Control:** the ALL OPEN count must equal the number of non-draft PRs listed above it in the same
section. If it does not, print `Line "LIVE" "MARCO QUEUE MISMATCH: ..."`.

Do not touch section 7. These lines never feed the SAFE / CAUTION / DO-NOT-ACT verdict.

## 3. `docs/pipeline/stations/00-supervisor.md`, under **ARM ONE AT A TIME**

Add one paragraph:

> Read the sweep's WAITING ON MARCO line before arming. Arming one at a time stops collisions in
> the dev tree. It does not protect Marco's queue: every armed prompt that is not docs-only adds a PR
> he must release. There is no limit (Marco, 2026-10-03), so the call is yours. Whenever you arm,
> copy both lines' figures into your breadcrumb. They are the evidence for any future limit.

Run `lint-station.mjs` and re-record canonical hashes if it asks.

## Tests: `scripts/pipeline/__tests__/marco-queue.test.mjs`

1. Three PRs: one labelled do-not-merge (oldest), one unlabelled, one draft labelled. Expect
   waiting 1, open 2, and the right oldest PR in each.
2. The labelled PR is not the oldest: `waiting.oldest` is the oldest *labelled* PR.
3. Empty array: both counts 0 and both oldest `null`. The CLI prints the no-oldest line.
4. Hours round down: 5h59m reads 5.
5. Non-array input throws. The CLI prints `[CANNOT MEASURE]` and exits 2, and never prints a 0 count.
6. A source check that `status-sweep.ps1` calls `marco-queue.mjs` in section 1 and that no
   `MARCO_QUEUE` text appears in section 7.

`escalates: true`: it changes a station document. It opens labelled `do-not-merge`, and Marco
releases it.
