# Station 00 — Supervisor | 2026-10-09T21:25Z–2026-10-09T21:3xZ (follow-up to the 21:06Z cycle)

## GROUND

```
UTC            2026-10-09T21:25Z
origin/main    f0ee3b99   (fetch +refs/heads/main:refs/remotes/origin/main, then rev-parse)
dev tree       main @ f0ee3b99   C:\ProjectOperations2   (== origin/main, all four read-backs clean)
doc version    1   (docs/pipeline/stations/00-supervisor.md, read from origin/main this cycle)
bootstrap      1   — MATCHES
```

This is the **same hourly run** as
`archive/00-00-supervisor-2026-10-09-2106-ff-unblocked-the-trunk-red-is-a-docker-pull-rate-limit-and-no-hold-is-admissible.md`
(merged as #2297). It exists because that breadcrumb's F2 said *"next cycle must confirm"* and the
confirmation arrived **inside this run, and it was negative.** Correcting it here rather than
leaving a merged breadcrumb to be read as settled.

## WHAT I MEASURED

- **[MEASURED] The re-run reproduced the failure.** `gh run rerun --failed` on both red workflows
  returned both runs to `completed / failure`:
  - CI `37990313946`, job `API — lint, test, compliance smoke` — first attempt `114022548558`
    failed 20:57:08Z; the re-run `114029134082` failed **21:15:05Z**, failing step
    `Initialize containers` both times.
  - Tendering Browser Smoke `37990311547`, job `tendering-e2e` — first attempt `114024723167`
    failed 21:03:01Z; the re-run `114029142344` failed again, same step.
- **[MEASURED] Same cause, quoted from the re-run's log, three back-offs then death:**
  `Error response from daemon: toomanyrequests: You have reached your unauthenticated pull rate
  limit. https://www.docker.com/increase-rate-limit` → `##[error]Docker pull failed with exit code 1`,
  at 21:14:51Z, 21:14:59Z and 21:15:05Z.
- **[MEASURED] Scope of the damage.** `Initialize containers` runs **before `actions/checkout`**, so
  only jobs declaring a service container are affected. Docs-only PRs skip them via the changed-path
  filter — confirmed live: **#2297 merged CLEAN at 21:21:47Z** in the middle of this window, with
  `Approval receipt (CP-26)` and `PR gates — diff checks` both `pass` and the API/web/e2e jobs
  `skipping`. So the board is not frozen; the next **code** PR is what will sit red.
- **[MEASURED] `needs-marco/` is gitignored by rule and partly tracked in fact, still.**
  `git check-ignore -v` on the new escalation file → `.gitignore:82:docs/pr-prompts/needs-marco/`,
  exit 0; `git ls-files -- docs/pr-prompts/needs-marco/` → **12** tracked files. (The contract's
  figure of 6-of-61 is dated 2026-09-22 — state, not instruction. Re-measured, not quoted.)
- **[MEASURED] Dev tree after #2297 merged:** fast-forwarded `120b7ad3 → f0ee3b99` under the board
  lease with **no blocking path this time** (`git status --porcelain --untracked-files=no` was
  already EMPTY before the merge — the arming-log restore earlier in the run held). Read-backs:
  `rev-list --left-right` → `0 0`, `--numstat origin/main` EMPTY, `--cached` EMPTY,
  `--porcelain --untracked-files=no` EMPTY. Worktree `C:\po-wt\bc2106` removed
  (`WT_STILL_THERE=False`), branch deleted, lease released and read back **absent**.

## WHAT CHANGED

1. **Raised a new escalation on disk** —
   `docs/pr-prompts/needs-marco/ci-service-containers-fail-on-docker-hub-unauthenticated-pull-rate-limit-2026-10-09.md`.
   One question, three options, RULE 1 applied, complete-and-additive first. Gitignored like the
   other 52, so `status-sweep.ps1` reads it from disk; this breadcrumb is how it reaches Marco's
   reading.
2. **#2297 merged** — `Assert-SmokedOrEscalate -PR 2297` → `True`, then
   `Merge-Pr -PR 2297 -Actor 'station-00.scheduled'` → `State = MERGED`, read back
   `gh pr view 2297 --json state,mergedAt` → `MERGED  2026-10-09T21:21:47Z`. Docs-only, inside
   Station 00's recorded lane, no receipt required by diff (no migration, nothing outside
   `tests|docs`). Lease free before and after.
3. **Nothing else.** No workflow file touched, no secret created or requested, no image reference
   changed, no third re-run, nothing armed, no label moved.

## FINDINGS

### F1 — F3's trigger has fired: the rate limit is a standing condition, not a blip, and the cure is Marco's

The 21:06Z breadcrumb deferred the permanent cure and named the trigger: *"a second container-init
rate-limit failure on `main` within 24 h"*. It took **18 minutes.** A rate limit that survives a
re-run is not transient, and re-running a third time would be the mask DOCTRINE §8.2 forbids.

The two live options, unchanged from F3 and now written out in full in the escalation file:

1. **Complete and additive — authenticate the pull.** `docker/login-action` plus a Docker Hub token
   in a repository secret. Fixes every service container and every future image, changes no
   behaviour, touches no data. A free Docker Hub account clears the limit being hit. It fails only
   the autonomy half: a secret is an authorization grant, a hard stop (DOCTRINE §5.4). Station 00
   can ship the workflow change and a runbook naming the exact secrets and the token scope; Marco
   creates the secret.
2. **Partial — move the service images to a registry with no unauthenticated limit.** No secret, so
   landable by a station. Fails the complete half twice: it is an unmade supply-chain choice, and it
   fixes only the images someone remembers to change.

Doing nothing is named and rejected in the escalation: it leaves `main` red, makes the next code
PR's redness ambiguous, and teaches the next agent to re-run reds without a cause.

**DISPOSITION: ESCALATED** — the escalation file above is the question. **It supersedes the 21:06Z
breadcrumb's F2 `ACTIONED` and F3 `DEFERRED`**; anyone reading that breadcrumb alone will think a
re-run settled this. It did not.

### F2 — A breadcrumb that merges mid-run can be stale before the run ends

#2297's F2 reads *"the failed jobs were re-run … next cycle must confirm"*, and that sentence was
already false 6 minutes after it merged, measured by the same run that wrote it. Nothing warned:
the breadcrumb is immutable once merged, the contract's expiry mechanism is "state lives in the
breadcrumb, where it can expire", and **expire here meant "be contradicted by its own author before
the hour was out"**, not "go quietly out of date".

The cure is cheap and this run is the worked example: when a run takes an action whose outcome
arrives *within the same run*, **either hold the breadcrumb until the outcome is in it, or publish a
follow-up in the same cycle.** What is not acceptable is leaving the first reading as the only one
on `main` — the next station reads `ACTIONED` and moves on.

**DISPOSITION: ACTIONED** — this breadcrumb is the follow-up, published in the same cycle, and F1
names the superseded dispositions explicitly so a reader of either file lands in the right place.

### F3 — `gh --jq` with `//"-"` inside a PowerShell `-Command` layer failed loudly, not silently

`gh run view <id> --json status,conclusion --jq '["CI",.status,(.conclusion//"-")]|@tsv'` came back
`failed to parse jq expression … unexpected token ")"`, with the expression echoed as
`[CI,.status,(.conclusion//-)]` — **every double quote stripped before `gh` saw it.** The cure is
DOCTRINE §9.4's standing one and it worked first try: take raw `--json` and `ConvertFrom-Json` in
PowerShell.

Worth recording because of what it is evidence *for*. STATION-CAPABILITIES' GitHub section was
narrowed on 2026-10-09 (`JQ_LOUD_FAILURE_NOT_REPRODUCED_V1`) after Station 04 measured escaped
double quotes surviving into `gh`'s argv and returning the correct answer — and that narrowing is
careful to say *"one non-reproduction does not prove it never fails"*. **This is the failing case,
measured the same day, at PS `5.1.26100.9444`:** quotes did not survive, and it failed **loudly**
with a parser error, exactly as the pre-narrowing sentence said. So both readings are real; what
differs is the escaping depth, and the raw-`--json` rule is the cure either way.

**DISPOSITION: DEFERRED** — a one-paragraph addition to the `JQ_LOUD_FAILURE_NOT_REPRODUCED_V1`
narrowing, recording that the loud-failure case DID reproduce here with the quoted command and the
PS version. Not landed this cycle: `STATION-CAPABILITIES.md`'s GitHub section is not in a hash-gated
block, but the edit wants Station 04's corpus discipline and there is no urgency — the operative
rule (raw `--json`) is already current in both documents. ⚠️ Falsifying probe for whoever lands it:
run the same `--jq` expression through a `-Command` layer and through a `.ps1` with `-File`; if the
`-File` form also strips the quotes, the cause is not the `-Command` layer and this paragraph is
wrong.

## WHAT I DID NOT DO

- **Did not touch a single workflow file**, and did not create, request, or name a value for any
  secret. Option 1 needs Marco's grant; writing the PR before he has chosen would be staging work
  he may not want.
- **Did not re-run the failed jobs a third time.** The cause is named and reproduced; a third
  re-run is a mask, not a diagnosis.
- **Did not merge, update, or label #2294.** It is still `do-not-merge`, still Marco's, and its two
  reds are still the gate itself (21:06Z breadcrumb F4). Its redness is unrelated to F1 here — CP-26
  and the diff-check both run containerless and both reported promptly.
- **Did not arm anything.** Unchanged from the 21:06Z measurement: 0 of 13 depth-1 HOLDs admissible.
  Note for the next cycle: **arming a code prompt while F1 stands will produce a PR that cannot go
  green**, because `API — lint, test, compliance smoke` is required and cannot start. A docs-only
  prompt is unaffected.
- **Did not re-run `status-sweep.ps1` before the #2297 merge.** Deliberate, and named as a
  deviation: the core says re-run it immediately before every board mutation, and its runtime is
  189 s with the verdict in the last 71 lines of 471 — which is the very defect #2294 exists to fix.
  Instead I re-measured the gate's own inputs directly, immediately before the merge, and quote
  them: `lease=free`, `index.lock devtree=False`, `index.lock clone=False`, `git processes=0`,
  newest open-PR `updatedAt` 21:19:17Z (#2297 itself, i.e. nothing else touched). `Merge-Pr` then
  took the lease itself. **This is a narrower instrument than the sweep, not a stronger one** — if a
  future reader wants the full gate, #2294 is what makes it affordable.
- **Did not clear any `[STALE]` escalation row**, did not prune any of the 33 non-main worktrees or
  3 registry escapees (Station 03's lane, and 03 is not MISSED at 22.1 h against a 24 h + 3 h
  window), and did not touch Azure / Entra / SharePoint or production data.
