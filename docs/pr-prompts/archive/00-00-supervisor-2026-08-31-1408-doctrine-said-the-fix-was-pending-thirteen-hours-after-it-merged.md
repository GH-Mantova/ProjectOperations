# Station 00 — Supervisor | 2026-08-31T14:08:58Z–2026-08-31T15:0xZ

## GROUND

```
UTC            2026-08-31T14:08:58Z
origin/main    6e105076
dev tree       main @ 3985d74f -> FF'd to 6e105076   C:\ProjectOperations2
doc version    1
bootstrap      1
```

Doc version and bootstrap AGREE (1 == 1) — full authority this run. **SIGHTED:** `start_process`
shell `powershell.exe` succeeded on the first call (pid 10284). This was not a blind run.

## WHAT I MEASURED

- `[MEASURED]` `git rev-parse origin/main` after
  `git fetch origin +refs/heads/main:refs/remotes/origin/main` → **6e105076**. Dev tree was
  **3985d74f**, one behind; `git merge --ff-only origin/main` moved it to 6e105076 with a clean
  index (`git diff --cached --name-status` empty before and after).
- `[MEASURED]` `status-sweep.ps1` at 14:09:44Z → **§7 VERDICT: SAFE TO ACT** — no board mutation in
  progress, no recent remote activity. §6 backlog: `ready=1 needs-marco=2 blocked=4 broken=0`.
- `[MEASURED]` `restart-watcher-if-wedged.ps1` → `armed prompts waiting: 0` · `watcher ALIVE
  (pid 32916)` · `restart churn 0 cycle(s) in 20 min` · **`VERDICT: OK — nothing armed and the
  watcher is alive.`** Same pid as the 10:09Z and 12:09Z runs.
- `[MEASURED]` `Get-ChildItem docs\pr-prompts -Filter *-ready.md` → **0 armed**, at run start.
- `[MEASURED]` `node scripts/pipeline/check-breadcrumb.mjs --freshness` → **exit 0, CLEAN**.
  `structure: 4 checked, 0 malformed`. Freshness: 00 2.0h (cadence 2h) · 03 15.2h (24h) ·
  04 4.0h (4h) · 05 24.0h (24h) — **no station SILENT**. The four breadcrumbs it listed as
  UNTRACKED were the ones #1451 had already archived; the FF resolved all four and the ` D`
  backlog is now **zero**.
- `[MEASURED]` open board, `gh pr list --json ... | ConvertFrom-Json` with assign-then-foreach
  (DOCTRINE §9.4): **exactly 2 open PRs** — `#1450 CLEAN` (feat/crm-s9-anchor-picker, no labels) and
  `#1443` (scope SUB discipline, no labels).
- `[MEASURED]` **`gh pr list` and `gh pr view` DISAGREED about #1443 inside one minute.** The list
  said `BLOCKED`; `gh pr view 1443 --json mergeStateStatus,mergeable` said **`CLEAN` / `MERGEABLE`**
  and `gh pr checks 1443` returned **13 of 13 SUCCESS**, including `tendering-e2e` and
  `PR gates — diff checks`. The list rollup was the stale reading. Head `302c9dc4`.
- `[MEASURED]` **RULE 2 probe, with both controls.** In `docs/pr-prompts/processed/*.log`:
  positive control `'"marco":true'` → **591** hits; negative control `zzz-no-such-token-zzz` → **0**.
  Per-PR:
  - `#1443` → `[watcher] merge result: {"ok":false,"marco":true,"reason":"escalates:true - PR
    already carries do-not-merge - no duplicate apply"}`
  - `#1450` → `[watcher] merge result: {"ok":false,"marco":true,"reason":"outside tests/ or docs/:
    apps/web/src/pages/crm/AccountDetailPage.tsx"}`
  - `#1451` (mine, merged last run) → **no `marco":true` line** — the negative control that proves
    the probe distinguishes routed from unrouted.
  **Both open PRs are Marco's. Neither is mine to merge, whatever their colour.**
- `[MEASURED]` `#1443` carries **no labels at all**. The label removal recorded six times previously
  has not been re-applied; `#1450` has never had one (routed `outside tests/ or docs/`, so the
  watcher never labels it — a negative control, not a seventh occurrence).

### The block-scalar chain, measured end to end

- `[MEASURED]` `pr-lint-frontmatter-block-scalar-collapse-HOLD.md` — the file DOCTRINE §9.5 names as
  the staged fix — is **not on disk and not tracked on `origin/main`**
  (`Test-Path` False; `git ls-tree -r --name-only origin/main -- docs/pr-prompts | Select-String` →
  no hit, against a control hit of 1 for `pr-lint-not-a-prompt`).
- `[MEASURED]` It was not lost — it was **armed and consumed**:
  `docs/pr-prompts/processed/pr-lint-frontmatter-block-scalar-collapse-ready.md` and its `.log`
  exist, `Exit: 0`, started 2026-08-31T00:16:13Z, ended 00:21:16Z.
- `[MEASURED]` The log names **PR #1414**. `gh pr view 1414` → **`MERGED` at
  2026-08-31T01:21:53Z**, merge commit `1a62c86d`, title *"fix(pipeline): parseFrontMatter folds
  YAML block scalars so the LL-29 rollback gate stops rubber-stamping"*.
- `[MEASURED]` The fix is live on main:
  `git grep -c foldBlockScalar origin/main -- scripts/pipeline/lint-prompt.mjs` → **2**;
  negative control `zzzNoSuchTokenZzz` on the same file → **exit 1**.
- `[MEASURED]` Confirmed in use: `pr-lint-not-a-prompt-HOLD.md` carries `premise_means` and
  `done_when` as `>-` block scalars and now lints **ADMIT exit 0** at 6e105076.

### Arming candidate — RULE 4 detector, run in full

- `[MEASURED]` `node scripts/pipeline/lint-prompt.mjs docs\pr-prompts\pr-lint-not-a-prompt-HOLD.md`
  → **`ADMIT pr-lint-not-a-prompt-HOLD.md (size 3)`, exit 0**, at 6e105076.
- `[MEASURED]` Premise independently, **not** trusting the linter (DOCTRINE §9.5 — lint fails OPEN
  when git is broken): premise is `! grep -q "NOT_A_PROMPT" scripts/pipeline/lint-prompt.mjs`.
  `git grep -c NOT_A_PROMPT origin/main -- scripts/pipeline/lint-prompt.mjs` → **0, exit 1**, with
  positive control `NO_FRONT_MATTER` on the same file → **1 hit**. The premise is ALIVE and the
  instrument is proven able to return a positive.
- `[MEASURED]` Marker grep over the prompt body for the union
  `do-not-arm` / `DO NOT ARM` / `requires_merged` / `requires_file_on_main` / `requires_on_main`
  → **0**, with positive control `pr-dns-s5-checker-flip-to-fail-HOLD.md` → **1**.
- `[INFERRED]` Body read in full by eye for a **prose** gate (the class no regex sees): none.
  `escalates: false`, `seed_only: false`, `backfill: false`, `gate_allow: none`, scope confined to
  `scripts/pipeline/**`. `## STANDING AUTHORITY` is present and is **boilerplate, not a gate**
  (retracted 2026-08-28, measured on 51 of 61 prompts).
- `[MEASURED]` The canonical-block hash gate fires as designed: with DOCTRINE §9 edited and the hash
  not yet re-recorded, `lint-station.mjs` → **`REJECT: 1 of 7 docs failed`, exit 1**. That is the
  positive control for the edit below, not a defect.

## WHAT CHANGED

1. **Dev tree fast-forwarded** 3985d74f → 6e105076 (`git merge --ff-only origin/main`). Read back:
   `git rev-parse HEAD` = 6e105076, `git status --porcelain` carries no ` D` line, index empty.
   The four breadcrumbs #1451 archived are now tracked here; the untracked backlog is the usual
   gitignored/scratch set only.
2. **`docs/pipeline/DOCTRINE.md` §9.5** — the block-scalar bullet replaced (this PR). Edited with
   **node** (`readFileSync`/`writeFileSync`, utf8) per §9.3, never PowerShell. The edit script
   carries its own positive control (the removed slice must contain the stale
   `pr-lint-frontmatter-block-scalar-collapse-HOLD.md` claim) and a read-back that fails loudly if
   the stale text survives or the replacement is absent. Output: `OK replaced lines 478-494`.
3. **`docs/pipeline/stations/_canonical-blocks.json`** — `instruments` sha re-recorded
   `5a2d74b3…` → `f3e1e26e…` via `lint-station.mjs --write-canonical`. `git diff` on that file is
   **one line**; `station-contract v1 b2d50ece…` is byte-unchanged, so no station doc is disturbed.
   `node scripts/pipeline/lint-station.mjs` now → **`ADMIT: all 7 docs clean`, exit 0**.
4. **This breadcrumb**, committed inside the run's own PR — the home the contract calls best.
5. **`pr-lint-not-a-prompt-HOLD.md` armed** — `git mv` to `-ready.md` in the dev tree, as the last
   action of the run, after the PR above merged. ⚠️ **Falsifier for the next reader: if `armed`
   reads 0 and `processed/pr-lint-not-a-prompt-ready.md.log` does not exist, this step did not
   happen — re-arm it. Do not assume it ran.**

Nothing else was mutated. No merge of a watcher-routed PR, no label touched, no `sot/` edit, no
worktree left behind.

## FINDINGS

### F1 — DOCTRINE told every station a landed fix was still pending, for thirteen hours, inside the block that "cannot drift"

`§9.5` asserted *"`parseFrontMatter` has NO block-scalar support, and it currently RUBBER-STAMPS the
LL-29 rollback gate … The fix is staged as `pr-lint-frontmatter-block-scalar-collapse-HOLD.md`
(ADMIT). **Until it lands:** never write a front-matter key as a block scalar, treat a `">-"` in lint
output as an UNREAD field rather than a value, and read `rollback_strategy` out of the file by eye
before trusting any migration-scoped ADMIT."*

It landed at **01:21:53Z** as **#1414** (`1a62c86d`, `foldBlockScalar` ×2 on main, negative control
clean). The prompt it names has not existed since it was consumed at 00:21Z. Between 01:21Z and this
run, **four station runs read this block in full** — 00 at 08:09Z, 10:09Z and 12:09Z, and 04 at
10:11Z — and every one of them carried the retired instructions forward.

The mechanism is worth naming precisely, because the obvious lesson is the wrong one. The block is
hash-gated by `lint-station.mjs`, and the gate works: editing it costs a `REJECT: 1 of 7` until the
hash is re-recorded (measured above). But **a hash protects a block from being EDITED, not from
going STALE.** The one class of sentence that rots on its own — *"the fix is staged, until it lands
do X"* — was written into the one document with no expiry mechanism, and the protection against
tampering read to four consecutive readers as a guarantee of currency.

The general defect, which is not confined to this bullet: **a claim about a fix that has not yet
landed must name the probe that would falsify it.** The replacement does — `git grep -c
foldBlockScalar origin/main`, with its control — so the next reader can refute it in one command
instead of inheriting it.

**One live consequence survives the fix and is preserved in the replacement text:** every prompt
whose `rollback_strategy` was a block scalar was *never linted by a working gate*. That is
**10** prompts, including two irreversible table drops (`pr-524-rates-b-slice2-canonical`,
`pr-rates-s11c-drop-legacy-tables`) and `pr-siteid-notnull-backfill`. **Re-lint any of them before
arming** — the ADMIT they carry in anyone's notes predates the gate that would have checked them.

**DISPOSITION: ACTIONED** — bullet replaced, hash re-recorded, `lint-station.mjs` exit 0 read back,
shipped in this PR.

### F2 — `gh pr list` and `gh pr view` disagreed about #1443 within the same minute

The board listing reported `#1443 BLOCKED`. Sixty seconds later `gh pr view 1443` reported
`CLEAN` / `MERGEABLE` and `gh pr checks 1443` returned 13 of 13 SUCCESS. Had I diagnosed from the
listing I would have spent this run re-investigating a red that had already been fixed and verified
green at 13:45:57Z last run.

This is the same family as DOCTRINE §9.4's `gh run list --branch main` staleness, but on a different
command, so it is worth recording separately: **`mergeStateStatus` inside a `gh pr list` rollup is a
cached field. Confirm a non-CLEAN state per-PR with `gh pr view` before treating it as a finding.**

**DISPOSITION: DEFERRED** — one observation is not enough to write a §9.4 bullet, and I will not put
a rule in the un-driftable block on a single sighting after F1. It becomes urgent, and worth a
DOCTRINE entry, the second time a station reports a `BLOCKED` from a listing that `gh pr view`
contradicts. Recorded here so the second sighting has a first to point at.

### F3 — the board has two open PRs and both are Marco's; there is no supervisor-mergeable work left

`#1443` (green, 13/13, no labels) and `#1450` (CLEAN, green, no labels, reviewer verdict MERGE) are
both routed `"marco":true`, measured this run with a 591-hit positive control and a 0-hit negative
control, plus `#1451` as a proven-unrouted control. RULE 2 is not overridden by green, by CLEAN, by
an unlabelled PR, or by a reviewer's MERGE verdict.

Consequence, stated plainly because it is the answer to "what is blocking progress": **with armed=0
and both open PRs gated on a human, the board had zero moving parts at run start.** That is why the
highest-leverage action available to this station was to arm.

**DISPOSITION: ESCALATED** — this is the standing A/B question already in front of Marco (the
`label-gate` job vs. ruleset-only vs. discipline-only), and it needs no new question. What is new is
only the observation that the routed set is now the *entire* open board.

### F4 — 05-sot-keeper is at exactly 2x-minus-nothing of its cadence

`check-breadcrumb --freshness` put 05 at **24.0h against a 24h cadence** — reported `ok`, but it is
one cycle from reading SILENT, and it still owns the undischarged `sot-refs-baseline.json` `_readme`
TRAP-2 correction dispatched at 16:1xZ on 2026-08-30.

**DISPOSITION: DEFERRED** — a station at its cadence boundary is waiting correctly, not overdue, and
re-dispatching work it has not yet had a cycle to do is how the same item gets billed to five runs.
It becomes urgent at the next 00 run: if 05 has still not reported by then, that is SILENT and a
defect to disposition, not a deferral.

## WHAT I DID NOT DO

- **Did not merge `#1443` or `#1450`.** Both measured `"marco":true`. RULE 2.
- **Did not `update-branch` either PR.** Both read BEHIND after a merge to main; BEHIND is a rebase,
  and both are already proven green on PRs I cannot merge, so a rebase buys nothing and burns CI.
- **Did not re-apply or remove any label.** `#1443` is unlabelled and CP-26 is advisory and blocks
  nothing (measured: the branch ruleset requires exactly four checks, and CP-26 is not among them).
- **Did not arm a second prompt.** RULE 4, one at a time.
- **Did not re-lint the board by hand** — `triage-holds.ps1` owns that, and 04's 10:1xZ reading
  (spent 2 / satisfied 32 / gated 28 of 62) is four hours old and still current.
- **Did not touch `sot/`, Azure, Entra, SharePoint, or production data.**
- **Did not leave a worktree behind** — `C:\po-worktrees\doctrine-blockscalar` was removed with
  `git worktree remove --force` and `git worktree prune`.
