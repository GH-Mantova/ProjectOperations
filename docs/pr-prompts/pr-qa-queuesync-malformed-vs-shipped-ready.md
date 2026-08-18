---
premise: ! grep -q "lintExit -eq 3" scripts/pipeline/queue-sync.ps1
premise_means: queue-sync.ps1 still collapses EVERY non-zero lint exit into "shipped". A prompt that is merely MALFORMED (lint exit 1) is written to the consumed-ledger and never armed again - designed work is silently retired as if it had already shipped. The script's own comment at that branch says "only a CLEAN non-zero means 'shipped'", so the intent is documented but not implemented.
premise_means_check: grep -n "lintExit" scripts/pipeline/queue-sync.ps1
scope:
  - scripts/pipeline/queue-sync.ps1
done_when: grep -q "lintExit -eq 3" scripts/pipeline/queue-sync.ps1 && grep -qi "malformed" scripts/pipeline/queue-sync.ps1
size: 1
gate_allow: none
seed_only: false
escalates: false
---

# queue-sync: stop retiring MALFORMED prompts as "shipped"

## The defect (found by 04-scanner, 2026-08-18, main `8b5fb0a6`)

`scripts/pipeline/queue-sync.ps1` runs `lint-prompt.mjs` against every `*-ready.md` committed
on `origin/main` before materialising it into the queue tree. The gate is:

```powershell
$null = node (Join-Path $GitRepo "scripts\pipeline\lint-prompt.mjs") $tmp 2>&1
$lintExit = $LASTEXITCODE
if ($lintExit -ne 0) {
    $skipShipped++
    Say "shipped" ($name + " -- lint exit " + $lintExit + ", premise no longer true; not armed")
    if (-not $DryRun) { Add-Content -Path $Ledger -Value $name -Encoding ASCII }
    Remove-Item $tmp -Force -ErrorAction SilentlyContinue
    continue
}
```

`lint-prompt.mjs` has three meanings, not two:

| exit | meaning |
|---|---|
| 0 | ADMIT - arm it |
| 3 | STALE - the premise is dead, the work already shipped. Correctly retired. |
| 1 | REJECT - **the prompt is malformed.** The work has NOT shipped. |

The branch above treats **1 and 3 identically**. A malformed prompt is announced as `shipped`,
written to `.queue-sync-ledger.txt`, and thereafter skipped forever by the `$ledgerSet[$name]`
check - **without ever running, and without anything anywhere saying it was rejected.** The
comment two lines above the branch already states the correct rule and the code does not
implement it.

### Live proof at `8b5fb0a6`

- `docs/pr-prompts/pr-estimate-density-ratetable-ready.md` is committed as armed on
  `origin/main` and lints **exit 1** (`scope touches prisma/migrations but rollback_strategy is
  missing/empty`).
- It is nevertheless present in `docs/pr-prompts/.queue-sync-ledger.txt`, i.e. already recorded
  as consumed.
- It has no entry in `no-pr-opened/`, `failed/` or `shipped/` - it never ran.
- Net effect: real designed work (an estimate density rate table) is silently gone from the
  board, and the only trace is a log line that says the opposite of what happened.

Blast radius: every future prompt that lints 1. The louder the schema gets, the more work this
quietly eats.

## What to change

In `scripts/pipeline/queue-sync.ps1`, split the branch:

1. **`$lintExit -eq 3`** - unchanged behaviour. Count `$skipShipped`, `Say "shipped"`, ledger it.
2. **any other non-zero (1, 2, or anything else)** - this is **MALFORMED, not shipped**:
   - **Do NOT write it to the ledger.** It must be reconsidered on the next cycle once fixed.
   - Increment a new `$skipMalformed` counter and `Say "MALFORMED"` with the exit code and the
     prompt name, so the line is greppable and unmistakable.
   - Include `$skipMalformed` in the end-of-run summary line alongside the existing counters.
3. Keep the existing `WARN`/never-treat-as-shipped behaviour for a failed extract.

Also, as part of this run, repair the one file the bug already ate: remove the
`pr-estimate-density-ratetable-ready.md` line from
`C:\ProjectOperations2\docs\pr-prompts\.queue-sync-ledger.txt` (gitignored, machine-local, not
part of the commit) so the prompt is reconsidered once its `rollback_strategy` is supplied. Note
that in the PR body; do not add `rollback_strategy` yourself - that is the owning station's call.

## Verification

- `grep -n "lintExit" scripts/pipeline/queue-sync.ps1` shows a `-eq 3` branch and a distinct
  malformed branch.
- Run `pwsh scripts/pipeline/queue-sync.ps1 -DryRun` (or `powershell -File ...`) and paste the
  summary line into the PR body. A `-DryRun` must not write to the ledger at all.
- Confirm the malformed path does **not** append to `$Ledger` - read the file's line count
  before and after the dry run and assert it is unchanged.

## Guards this will trip

None expected: `scripts/**` only, no `sot/` (CP-24 clean), no migrations (CP-11/CP-23 clean),
no permission codes, no data-model change (CP-24 map drift clean). `gate_allow: none` is correct.

## Rollback

Single-file, non-destructive script edit. Revert the commit; queue-sync returns to its previous
behaviour. Nothing persists outside the repo except the one hand-removed ledger line, which
queue-sync re-adds by itself the next time the prompt is legitimately consumed.

---

STANDING AUTHORITY: you have standing authority to finish the work, commit, push, and OPEN THE
PR. Do not ask. An agent that finishes the work and then asks permission has failed.
