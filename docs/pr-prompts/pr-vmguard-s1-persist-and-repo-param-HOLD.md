---
premise: '! grep -q "ensure_on_path" scripts/pipeline/vm-git-guard.sh'
premise_means: >-
  vm-git-guard.sh installs the shim into ~/.local/bin but only PRINTS a note when that
  directory is not on PATH, so the guard is inert in any session that does not export it
  by hand. It is opt-in twice over: someone must run the installer, and someone must fix
  PATH. clear-stale-index-lock.ps1 also still hard-codes the dev tree, so the sanctioned
  cure cannot reach the watcher clone.
scope:
  - scripts/pipeline/vm-git-guard.sh
  - scripts/clear-stale-index-lock.ps1
done_when: >-
  grep -q "ensure_on_path" scripts/pipeline/vm-git-guard.sh && grep -q "param(" scripts/clear-stale-index-lock.ps1 && grep -q "Repo" scripts/clear-stale-index-lock.ps1
size: 2
gate_allow: none
seed_only: false
escalates: false
cluster: vm-git-guard
cluster_order: 1
---

# VM-GUARD-S1: the guard persists itself onto PATH, and the cure reaches both trees

**Grounded against `origin/main` = `f5c01415`, measured 2026-09-03.**

Decided by Marco 2026-09-03: option (a) + (b) on the device-bridge index-lock escalation.
This is the (b) half plus the `-Repo` parameter. The (a) half — installing the guard from
PREFLIGHT — is VM-GUARD-S2 and is gated on this slice.

## What is already true, and must not be rebuilt

`scripts/pipeline/vm-git-guard.sh` **exists on `origin/main`** (PR #1512, `d3b603e4`). It
installs a `git` shim at `$HOME/.local/bin/git` that refuses any call whose `$PWD` or whose
arguments resolve under `$HOME/mnt/` — which covers **every** connected folder, `C:\po-watcher`
included, rather than the two hard-coded trees the escalation asked for. It ships with two
positive controls: it fails if it does not refuse a mounted path, and fails again if it blocks
anything else.

**Do not rewrite the shim. Do not change its refusal rule.** This slice changes how it is
installed, and nothing about what it refuses.

## Do

1. **`vm-git-guard.sh` — add `ensure_on_path`, called after `chmod +x`.**
   It must be idempotent and must make the guard effective in the CURRENT shell as well as
   future ones:
   - append `export PATH="$HOME/.local/bin:$PATH"` to `$HOME/.bashrc` **only if an identical
     line is not already present** (grep -Fxq before appending — never append blind);
   - also append it to `$HOME/.profile` if that file exists, under the same guard;
   - `export PATH="$BIN:$PATH"` in the running script so the controls below run against the
     shim rather than the system git;
   - print one line saying which files it touched, or that both were already correct.
   - **Update the script's own UNINSTALL header.** It currently reads `rm -f "$HOME/.local/bin/git"`.
     After this change that is no longer a complete uninstall — the PATH line survives in the
     profile. The header must name both steps: remove the shim, and remove the exported line
     from `~/.bashrc` (and `~/.profile` if present). A persistence mechanism whose documented
     removal does not fully remove it is worse than one that is honest about being permanent.
2. **Extend the existing positive controls** to prove persistence, not just installation:
   - re-running the whole installer a second time must leave `.bashrc` byte-identical to
     after the first run (capture a hash before and after, compare, fail loudly if it grew);
   - `bash -lc 'command -v git'` must resolve to `$HOME/.local/bin/git`.
   Both must FAIL the script with a non-zero exit and a named reason, in the same style as
   the two controls already there.
3. **`clear-stale-index-lock.ps1` — add a `-Repo` parameter.**
   - `param([string]$Repo = "C:\ProjectOperations2")` as the first statement in the file, so
     every existing caller keeps working unchanged.
   - Derive `$lock = Join-Path $Repo ".git\index.lock"`.
   - Reject a `-Repo` that is not an existing directory containing a `.git` directory: write
     the reason and `exit 2`. A typo must not silently report "no lock file present."
   - Echo the resolved repo path in every output line that already names the lock, so a run
     log says which tree it acted on.
   - Keep the existing live-git-process check exactly as it is, and keep the file pure ASCII.

## Do NOT

- Do NOT change the shim's refusal rule, its message, or the paths it matches.
- Do NOT make `clear-stale-index-lock.ps1` iterate both trees by default. One invocation,
  one tree, named explicitly — a cure that clears locks you did not ask about is how a real
  lock gets deleted out from under a running command.
- Do NOT add the installer call to any station doc. That is S2 and it is separately gated.
- Do NOT touch `sot/`.

## Verify

- `bash scripts/pipeline/vm-git-guard.sh` exits 0 and reports what it changed.
- Run it a second time: exits 0, reports both files already correct, and `.bashrc` is
  byte-identical to after the first run.
- `bash -lc 'command -v git'` resolves to `$HOME/.local/bin/git`.
- Negative control: `git --version` in a directory outside `mnt/` still succeeds.
- Positive control: `git -C "$HOME/mnt" status` exits 99 with the REFUSED message.
- `pwsh -File scripts/clear-stale-index-lock.ps1` with no argument behaves exactly as before.
- `... -Repo "C:\po-watcher\ProjectOperations"` reports on that tree and names it in the output.
- `... -Repo "C:\does\not\exist"` exits 2 with a named reason.

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

Every scope limit stated above still applies. A scope limit is **not** a reason to stop
before pushing.
