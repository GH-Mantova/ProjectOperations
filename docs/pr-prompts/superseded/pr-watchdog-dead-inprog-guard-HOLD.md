---
premise: grep -q "inProg" scripts/pr-watcher/supervise-watcher.ps1
premise_means: >-
  supervise-watcher.ps1:582 reads docs/pr-prompts/in-progress/, a directory NO producer writes, and
  :583 uses that count as a guard - "if ($inProg.Count -gt 0) { continue }  # a build is running:
  not hung". scripts/pr-watcher/index.mjs never mentions "in-progress" (git grep exit 1, positive
  control classifyPolicyFiles exit 0, negative control on a nonsense token exit 1); its real
  destinations are processed/, failed/, no-pr-opened/, blocked/ and paused/. The directory is not
  tracked on origin/main and Test-Path returns False on the dev tree. So the guard has never once
  been able to fire, and the watchdog's log line at :368 and :599 both announce an in-progress
  check that does not exist. Measured 2026-09-01T02:55Z at 1efd079c.
scope:
  - scripts/pr-watcher/supervise-watcher.ps1
done_when: >-
  ! grep -q "inProg" scripts/pr-watcher/supervise-watcher.ps1 && grep -q "heartbeat-only"
  scripts/pr-watcher/supervise-watcher.ps1
size: 1
gate_allow: none
seed_only: false
escalates: false
backfill: false
---

# The watchdog's "a build is running" guard reads a directory nothing writes, and has never fired

## The defect

`scripts/pr-watcher/supervise-watcher.ps1:582-583`, inside the heartbeat watchdog job:

```powershell
$inProg = @(Get-ChildItem (Join-Path $PromptDir 'in-progress\*.md') -File -ErrorAction SilentlyContinue)
if ($inProg.Count -gt 0) { continue }                     # a build is running: not hung
```

`docs/pr-prompts/in-progress/` has **no producer**. `git grep -n "in-progress" origin/main --
scripts/pr-watcher/index.mjs` returns nothing and exits 1, with a passing positive control
(`classifyPolicyFiles` -> exit 0) and a passing negative control (`qqzzxxnotarealtokenqqzzxx` ->
exit 1). The watcher moves prompts to `processed/`, `failed/`, `no-pr-opened/`, `blocked/` and
`paused/` and to nothing else. The directory is absent from `origin/main` (603 tracked paths under
`docs/pr-prompts/`, zero containing `in-progress`) and `Test-Path` on the dev tree returns False.

`$inProg.Count` is therefore permanently `0`, the `continue` never executes, and the guard is
decorative. Two log lines assert otherwise:

- `:368` `"...restart the node if heartbeat is stale > $wdHungMin min while runnable>0 and 0 in-progress..."`
- `:599` `"heartbeat stale {0} min with armed={1} runnable={2} 0 in-progress -> node HUNG..."`

Both tell a reader the watchdog confirmed no build was in flight before killing. It confirmed
nothing of the sort.

## Why the fix is to DELETE the guard, not to repair it

🔴 **Read this before changing behaviour.** The obvious "fix" is to make the guard work against a
real signal. **That would be wrong, and it would damage the watchdog.**

The heartbeat watchdog exists for exactly the case the guard would suppress. From this file's own
header at `:70-77`: on 2026-08-11 the node hung *mid-run* with its heartbeat frozen ~40 minutes
while 16 prompts sat armed, "the whole in-chain queue stopped draining and nothing restarted it."
A hung node is, by definition, a node that believes it is building. A working "a build is running,
so do not kill" guard would have prevented the restart that incident demanded.

So the current runtime behaviour is **correct**, and it is correct by accident. The defect is that
the code claims a safety check it does not perform - which is what sends the next reader looking
for a protection that was never there.

**Therefore: remove the dead read and the dead guard, change no runtime behaviour whatsoever, and
correct the log lines so they describe what the watchdog actually tests.**

## What to build

All changes are confined to `scripts/pr-watcher/supervise-watcher.ps1`.

1. **Delete `:582` and `:583`** - the `$inProg` assignment and the `if ($inProg.Count -gt 0) { continue }`
   guard. Nothing else in the file references `$inProg`; confirm with a grep before and after.
2. **Rewrite the `:368` startup log line** so it states the real test: the node is restarted when
   the heartbeat is stale beyond the threshold while runnable > 0. It must contain the literal
   token `heartbeat-only` so a reader (and `done_when`) can see the test named honestly. Keep the
   rest of the line - thresholds, poll interval, `.queue-state.json` provenance - as it is.
3. **Rewrite the `:599` kill log line** to drop `0 in-progress` and say the same thing: heartbeat
   stale, runnable > 0, therefore treated as hung. Keep the pid, the ages and the counts.
4. **Add a short comment where the guard was**, recording that a build-in-flight guard is
   deliberately absent because a hung node is one that believes it is building, and citing the
   2026-08-11 incident already described at `:70-77`. This is the part that stops someone
   reinstating it.

**Leave `:111` exactly as it is.** It reads "(7 prompts armed, 0 in-progress)" inside a comment
describing the 2026-08-18 incident. That is an accurate historical record of what was observed, not
a live check, and rewriting history to tidy a grep would destroy a lesson.

## Prove it before you believe it

- `grep -c "inProg" scripts/pr-watcher/supervise-watcher.ps1` must read **2** before your change
  and **0** after. Quote both in the PR body.
- `grep -c "in-progress" scripts/pr-watcher/supervise-watcher.ps1` must read **4** before and
  **1** after - the survivor being `:111`. Quote both.
- The file must still parse. Run
  `powershell -NoProfile -Command "$env:PR_WATCHER_SUPERVISOR_DOTSOURCE_ONLY='1'; . .\scripts\pr-watcher\supervise-watcher.ps1; 'PARSE OK'"`
  and paste the result. That env var is the file's own documented test hook at `:344` and returns
  before the watchdog job, the main loop and every `Start-Sleep`, so this is safe to run.
- Run the existing watcher/supervisor test suite and paste the summary.

## Guard against the obvious way of getting this wrong

- **Do NOT start or stop the watcher, and do NOT restart anything.** This prompt edits a file. The
  running supervisor loaded its copy at start and is unaffected by an edit on disk; adopting the
  change is a separate operational decision that belongs to Marco, not to this run.
- Do NOT touch `scripts/pipeline/status-sweep.ps1`. It carries the same dead read at `:224` and is
  a SEPARATE prompt, deliberately, so the two cannot collide on one file.
- No single-letter PowerShell variables (DOCTRINE section 9.1, section 7 lie #5).
- No `Write-Output` inside any PowerShell function whose return value is captured (section 7 lie
  #6) - `Get-ChildFailureReason`, `Resolve-WatcherExitAction` and `Resolve-WatchdogChurn` all
  depend on this and all carry the warning in-file.
- The file is **pure ASCII by design** (`:29-30`): PS 5.1 reads UTF-8-without-BOM as Windows-1252,
  so an em-dash or curly quote becomes a parser error at load. Write ASCII only.
- Do not "fix" encoding with `Set-Content -Encoding UTF8` - that is the double-encoder (DOCTRINE
  section 9.3).

## Do NOT

- Do NOT create `docs/pr-prompts/in-progress/`. Nothing writes it; an empty directory would restore
  the same permanent zero with a folder to back it up.
- Do NOT make the guard "work" against `heartbeat.log`, `.queue-state.json` or any other signal.
  See the section above - that is a behaviour change that disables the watchdog for the exact
  failure it was built for.
- Do NOT change `$wdHungMin`, `$wdPollSec`, the churn thresholds, the sentinel-flag protocol, or
  any branch of `Resolve-WatcherExitAction`.
- Do NOT touch `/sot/`, `apps/**`, `prisma/**`, or any file outside `scope`.
- Do NOT run `git checkout .`, `git checkout -- <dir>`, `reset --hard`, `stash pop` or `git clean`
  anywhere. Consumed prompts retired into gitignored folders come back armed.

## VERIFY

```
node scripts/pipeline/lint-prompt.mjs docs/pr-prompts/pr-watchdog-dead-inprog-guard-ready.md
! grep -q "inProg" scripts/pr-watcher/supervise-watcher.ps1
grep -q "heartbeat-only" scripts/pr-watcher/supervise-watcher.ps1
grep -c "in-progress" scripts/pr-watcher/supervise-watcher.ps1
```

## STANDING AUTHORITY

**You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
**"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
approval before starting", and it does **not** mean "do the work then ask permission to push".
There is no human in this run. **Finishing the work and then asking for permission is
indistinguishable from failing** - the work is discarded either way.

## Guardrails

- One attempt. Never exit silently - say `NO-OP: <reason>` if you do nothing.
- Never ask a question or "stand by" for approval. There is no human in a headless run.
- Read the job log before diagnosing any CI failure; never reason a red out of the diff.
- Before you finish, ask: is there a PR number in my output?
