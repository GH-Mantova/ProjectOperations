---
premise: '! grep -q "MERGE_WAIT_HEARTBEAT" scripts/pr-watcher/index.mjs'
premise_means: The heartbeat stops while the watcher waits for a PR to merge, so a healthy merge-wait is indistinguishable from a hung node and the 15-minute watchdog kills the watcher roughly 16 minutes into every merge that is not near-instant.
scope:
  - scripts/pr-watcher/index.mjs
  - scripts/pr-watcher/supervise-watcher.ps1
  - scripts/pr-watcher/__tests__/merge-wait-heartbeat.spec.mjs
done_when: pnpm lint && grep -q "MERGE_WAIT_HEARTBEAT" scripts/pr-watcher/index.mjs && node --test scripts/pr-watcher/__tests__/merge-wait-heartbeat.spec.mjs
size: 4
gate_allow: none
seed_only: false
escalates: false
---

# The heartbeat watchdog kills a HEALTHY watcher during every merge-wait

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

Scope discipline still applies: touch **only** the three files in `scope`. That is a scope limit,
**not** a reason to stop before pushing.

## The defect — MEASURED 2026-08-24, three kills for three merges

`startHeartbeat()` is called **once**, at `index.mjs:2084`, immediately before the agent runs.
`stopHeartbeat()` fires at `:2091`, `:2344` and `:2584`. **The merge-wait functions —
`holdForMarco` (`:1388`), `waitForMerge` (`:1456`), `waitForPolicyMerge` (`:1510`) — never touch the
heartbeat.** So the moment a prompt opens a PR and enters merge-wait, the heartbeat goes silent.

Meanwhile `supervise-watcher.ps1:76` sets `$wdHungMin = 15`, and the watchdog kills the node when the
heartbeat is stale **> 15 min** while `armed > 0`, `runnable > 0` and `0 in-progress`. **A prompt in
merge-wait is still armed on disk but is not "in progress", so it satisfies every kill condition.**
The merge timeout is **90 min**. The two settings are incompatible.

Three consecutive kills on 2026-08-24, each ~16 minutes after entering merge-wait:

| PR opened, "waiting…" | killed at | flag |
|---|---|---|
| 23:46 → #1295 | 00:02:33Z | `armed=5 runnable=5 ageMin=16` |
| 00:18 → #1297 | 00:33:08Z | `armed=3 runnable=3 ageMin=16` |
| 02:20 → #1301 | 02:35:55Z | `armed=2 runnable=2 ageMin=16` |

**Consequence, also measured:** the killed run's prompt is still armed, so the relaunched watcher
re-queues and re-runs it. The re-run finds its own PR already open and exits `NO-OP: PR #N already
carries this exact change` — **a full agent run burned per merge**. Worse, this is very likely the
"unexplained external stop" recorded on 2026-08-21 and 2026-08-22, which was attributed to an unknown
actor because 4688 auditing is off. **The watcher has been killing itself.**

## What to build

### 1. Keep the heartbeat alive during merge-wait — `index.mjs`

Introduce a module-level marker const named **`MERGE_WAIT_HEARTBEAT`** (the greppable symbol
`done_when` asserts), and keep the heartbeat ticking for the whole merge-wait with a message that
says what it is waiting for — e.g. `waiting for merge of PR #1301 (elapsed=Ns)`.

Do it by **reusing the existing heartbeat machinery**, not by inventing a second one: `startHeartbeat`
already takes a `name` and a `getLastLine` callback, so start it again around the merge-wait with a
merge-flavoured name and stop it when the wait returns. Cover **all three** wait paths —
`holdForMarco`, `waitForMerge`, `waitForPolicyMerge` — and make sure the heartbeat is stopped on
every exit from them, including the timeout and error paths. A heartbeat left running after the wait
returns is a worse bug than the one you are fixing.

🔴 **Do NOT simply raise `$wdHungMin` above the merge timeout.** That would blind the watchdog to the
real alive-but-hung case it exists to catch (a node frozen ~40 min while 16 prompts sat armed, per
the comment at `supervise-watcher.ps1:69-74`). **The heartbeat must keep telling the truth**, so a
genuinely hung node still stops ticking and is still killed. A merge-wait that genuinely hangs is
already bounded by the 90-minute merge timeout.

### 2. Fix the throwing cast in the churn guard — `supervise-watcher.ps1:673`

Every watchdog kill logs:

```
Cannot convert the "System.Object[]" value of type "System.Object[]" to type "System.DateTime".
At ...\supervise-watcher.ps1:673 char:13
    $watchdogKillTimes = [System.Collections.Generic.List[dat ...
```

`[System.Collections.Generic.List[datetime]]$churn.Kept` cannot cast an `Object[]` directly. Use the
constructor form instead — e.g.
`[System.Collections.Generic.List[datetime]]::new([datetime[]]$churn.Kept)` — and verify it works for
an **empty** `Kept` array as well as a populated one, since PowerShell unrolls a single-element array.

⚠️ **Be precise about what this bug does and does not do.** The `.Add()` on the previous line still
succeeds, and `Resolve-WatchdogChurn` filters by window on every call, so the printed count has been
correct — the three observed kills were >20 min apart and each legitimately reported `1 of 4`. **The
cast failure has not yet produced a wrong verdict.** Fix it because a throwing line in a safety guard
is a latent hazard, not because it has already misfired. Say exactly that in the PR body; do not
claim a failure you cannot demonstrate.

⚠️ Note for the record, without changing it in this slice: kills arriving ~30 min apart can never
trip a 20-min / 4-kill window, so the churn guard as calibrated cannot catch this particular loop.
Fixing the heartbeat removes the loop; re-tuning the window is a separate decision for Marco.

### 3. Tests — `scripts/pr-watcher/__tests__/merge-wait-heartbeat.spec.mjs`

Use `node --test`, following the existing spec style in `scripts/pr-watcher/__tests__/`.

- the heartbeat is **ticking** while a simulated merge-wait is in progress;
- it **stops** once the wait returns — on the merged path, the timeout path, and the error path;
- the line written during merge-wait names the PR number, so the "last job name" disambiguator that
  Stations 00 and 03 rely on still identifies what the watcher is doing;
- **a negative control:** with no merge-wait and no agent running, the heartbeat does **not** tick —
  otherwise the watchdog would never catch a genuinely hung node again, and you would have replaced
  a false-kill bug with a never-kill bug.

## Do NOT

- Do NOT raise `$wdHungMin`, lower the merge timeout, or disable the watchdog.
- Do NOT change `Resolve-WatchdogChurn`'s window or threshold — that is Marco's call.
- Do NOT change the merge policy, the routing rules, or `extractPrNumber`.
- Do NOT touch `sot/` (CP-24) or anything Azure/Entra/SharePoint.

## Guardrails

- One attempt. If `MERGE_WAIT_HEARTBEAT` is already on main, say `NO-OP: <reason>` and stop.
- Never ask a question or "stand by" for approval. There is no human in a headless run.
- Read the CI job log before diagnosing any failure.
- `pnpm lint` and the new spec must both pass before pushing.
- ⚠️ You are editing the watcher that is **running you**, and the supervisor that restarts it. Your
  change takes effect only when the watcher is restarted from a fast-forwarded clone. Do not restart
  it yourself and do not expect to observe your own fix at runtime.
