---
premise: '! grep -q "VM_GIT_GUARD_NO_RECURSE" scripts/pipeline/vm-git-guard.sh'
premise_means: >-
  The device-bridge git guard still re-executes itself inside its own idempotency control, and its
  negative control still fails whenever the installer is run from a cwd under a mounted folder.
  MEASURED 2026-09-08T10:1xZ by Station 04 from inside a blind scheduled session: run with cwd
  /sessions/<id>/mnt/ProjectOperations2 the installer exits 1 with "FAIL: guard blocked a call that
  targets nothing mounted"; run from $HOME it exits 0 after 1017 nested self-invocations, 3053 lines
  and 318364 characters of output.
scope:
  - scripts/pipeline/vm-git-guard.sh
done_when: grep -q "VM_GIT_GUARD_NO_RECURSE" scripts/pipeline/vm-git-guard.sh && bash scripts/pipeline/vm-git-guard.sh
size: 1
gate_allow: none
seed_only: false
escalates: false
backfill: false
module: pipeline
---

# The device-bridge git guard fails its own self-test, and passes it 1017 times

`scripts/pipeline/vm-git-guard.sh` is the first thing every station doc tells a run to execute, and
the contract tells the run to quote its last line. Both of the defects below live in that last line.

## Defect 1 — the negative control does not neutralise `$PWD`, so the install fails from the obvious cwd

The shim decides `targets_mount` from the arguments **and** from the working directory:

```bash
case "$PWD/" in "$HOME"/mnt/*) targets_mount=1 ;; esac
```

That is correct behaviour for the shim — a bare `git status` inside the mount must be refused. But
the installer's own negative control at line 92 is:

```bash
if ! PATH="${BIN}:${PATH}" git --version >/dev/null 2>&1; then
  echo "FAIL: guard blocked a call that targets nothing mounted"; exit 1
fi
```

Run from a cwd under any mount — which is where a station naturally is — `git --version` is refused
by the `$PWD` rule, the control fails, and the installer exits 1 with a message that names a defect
the guard does not have. MEASURED: `cd /sessions/<id>/mnt/ProjectOperations2 && bash
scripts/pipeline/vm-git-guard.sh` → exit 1, that exact line. From `$HOME`: exit 0.

A station that follows its contract and quotes the last line therefore reports a fabricated defect,
which is the DOCTRINE section 7 pattern this guard exists to end.

## Defect 2 — the idempotency control re-executes the installer, recursively

Line 96:

```bash
bash "${BASH_SOURCE[0]}" 2>/dev/null || true
```

Each invocation runs a complete nested copy of itself, which runs another. MEASURED from `$HOME`:
**1017** nested invocations, 3053 lines, 318,364 characters of stdout, terminating only when the VM
hits a resource limit — swallowed by `|| true`. Only stderr is redirected, so the two success lines
are printed 1017 times and the exit code is 0.

The recursion is invisible to the exact instrument the contract prescribes: "the installer's last
line" is the innermost copy's, and it says both controls passed.

## What to build

One file: `scripts/pipeline/vm-git-guard.sh`.

1. **Add the marker `VM_GIT_GUARD_NO_RECURSE`** as the environment variable that guards the
   re-exec. The nested run must set it, and the installer must skip the re-exec (and report the
   idempotency control as skipped-because-nested, not as passed) when it is already set. The marker
   string is what this prompt's premise and `done_when` test for, so it must appear literally.
2. **Neutralise `$PWD` in the negative control** — run it from a directory that is not under
   `$HOME/mnt` (`cd /tmp` in a subshell is enough), so the control tests what its message claims:
   that a git call whose ARGUMENTS target nothing mounted is allowed.
3. **Add a third control** asserting the `$PWD` rule positively: from a cwd under `$HOME/mnt`, a
   bare `git --version` must be REFUSED with exit 99. Today that behaviour is real but untested, so
   nothing would catch its removal.
4. **Correct the comment block at the top.** "Git anywhere else in the VM (a scratch clone under
   `$HOME`, /tmp) is untouched" is true of arguments and false of cwd; say both, because a run that
   believes the first sentence will not understand why its scratch clone is refused.

Keep the shim's behaviour unchanged. The shim is right; the installer's controls and its
documentation are what is wrong.

## Do NOT

- Do **not** relax the shim. `targets_mount` on `$PWD` stays. A cut-short `git` against the Windows
  `.git` leaves a 0-byte `index.lock` with no owning process and freezes every station — DOCTRINE
  section 9.2, seven occurrences.
- Do **not** touch `docs/pipeline/DOCTRINE.md`, `docs/pipeline/STATION-CAPABILITIES.md` or any
  station doc. They point at this script; the script is what changes. A doc change here would also
  make this a multi-file PR across a hash-gated canonical block.
- Do **not** paraphrase a DOCTRINE section 9 trap into this script's comments. Point to the section.
- Do **not** add `sot/` anything. CP-24 hard-fails a PR mixing `sot/` with code.

## Guardrails

- One attempt. Never exit silently: if the work is already on `main`, say `NO-OP: <reason>`.
- Never ask a question or stand by for approval — there is no human in a headless run.
- Read the job log before diagnosing any CI failure.
- **Verify by running it, both ways.** The acceptance evidence is two runs quoted in the PR body:
  one with cwd under `/sessions/<id>/mnt/ProjectOperations2` and one from `$HOME`, each showing exit
  0 and a single copy of the success lines. A green CI job does not exercise this script at all.
- This scope is `scripts/`, not `tests/` or `docs/`, so `classifyPolicyFiles` routes the PR to
  Marco. Open it and leave it unmerged.

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** - the work is discarded either way.
