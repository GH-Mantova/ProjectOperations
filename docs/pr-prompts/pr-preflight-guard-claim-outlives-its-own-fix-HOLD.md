---
premise: grep -q "persists itself onto" docs/pipeline/stations/04-scanner.md
premise_means: The canonical PREFLIGHT block still tells every station that vm-git-guard.sh persists itself onto PATH, while the guard itself — since PR #2065 merged 2026-09-22T02:58Z — reports INSTALLED BUT INERT and exits 2 in the shell a station is actually given.
scope:
  - docs/pipeline/stations/00-supervisor.md
  - docs/pipeline/stations/01-code-writer.md
  - docs/pipeline/stations/02-board-driver.md
  - docs/pipeline/stations/03-machine-minder.md
  - docs/pipeline/stations/04-scanner.md
  - docs/pipeline/stations/05-sot-keeper.md
  - docs/pipeline/stations/06-pr-master.md
  - docs/pipeline/stations/_canonical-blocks.json
  - docs/pr-prompts/superseded/pr-preflight-guard-claim-outlives-its-own-fix-HOLD.md
done_when: node scripts/pipeline/lint-station.mjs && ! grep -rq "persists itself onto" docs/pipeline/stations/ && grep -rq "INSTALLED BUT INERT" docs/pipeline/stations/04-scanner.md && ! test -f docs/pr-prompts/pr-preflight-guard-claim-outlives-its-own-fix-HOLD.md
size: 9
gate_allow: none
seed_only: false
escalates: false
---

# The PREFLIGHT block promises a mechanical git ban that its own fix reports as inert

**Authored by Station 04 (Scanner), 2026-09-22T06:1xZ, at `origin/main` `447bff3b`. Staged `-HOLD`.
Station 04 arms nothing — Station 00 decides whether and when this runs.**

## The defect

`docs/pipeline/stations/*.md` all carry the `station-contract v3` CANONICAL-BLOCK. Its PREFLIGHT
step 1 says of `scripts/pipeline/vm-git-guard.sh`:

> It is idempotent, it persists itself onto `PATH`, and it refuses `git` **only** against a mounted
> folder

and then, of a bad outcome:

> **A failed install is a FINDING, not a STOP:** say so and carry on.

**PR #2065 (`fix(pipeline): vm-git-guard self-certifies success while inert`, merged
2026-09-22T02:58:44Z) changed what the guard reports, and touched only
`scripts/pipeline/vm-git-guard.sh`.** Its file list is one entry. The seven station docs were not
part of that PR, so the sentences above are now describing the guard as it behaved before the fix.

[MEASURED] 2026-09-22T06:16Z by Station 04, running the installer exactly as PREFLIGHT prescribes:

```
ensure_on_path: both ~/.bashrc and ~/.profile (if present) were already correct
vm-git-guard INSTALLED BUT INERT - the shim is correct and UNREACHABLE from your shell.

  bash -lc 'command -v git' -> <session>/.local/bin/git
  bash -c  'command -v git' -> /usr/bin/git
      (the shell a STATION IS GIVEN: resolves the real git - no protection)

=> THE DEVICE-BRIDGE GIT BAN IS NOT MECHANICAL IN THIS SHELL.
```

exit code **2**.

**Two distinct edits are needed, and they are in the same sentence-pair.**

**(a) The claim.** *"It persists itself onto `PATH`"* is true only of a **login** shell. A station's
shell is non-interactive and non-login, reads neither `~/.bashrc` nor `~/.profile`, and resolves
`/usr/bin/git`. A reader who takes the block at its word believes a ban is being enforced for them
when it is not — and the block's own next sentence (*"Without it, a cut-short call against the mount
leaves a 0-byte `index.lock` … it freezes every station"*) is what makes that belief consequential.

**(b) The vocabulary has no case for the state the guard now reports.** The block classifies outcomes
as install-passed or *"a failed install"*. Exit 2 here is **neither**: the install succeeded, the shim
is byte-correct, and the guard says the word `INSTALLED` in its own headline. A station matching the
block's vocabulary against the guard's output has no instruction for the third state — which is
exactly the shape DOCTRINE §7 records as the expensive one, a well-formed reading with no bucket.

**(c) The one-call cure is printed by the guard and absent from the block.** The guard's last line is
the only protection actually available to a station:

```
PATH="<session>/.local/bin:$PATH" git <args>
```

The block never mentions it, so a station that wants the ban enforced for a single call has to read
it out of the tool's stderr rather than out of its own binding instructions.

## What to build

1. Edit the `station-contract v3` canonical block **identically in all seven** station docs
   (`00-supervisor.md` … `06-pr-master.md`) so that PREFLIGHT step 1:
   - states that the installer writes the shim and the `PATH` export, and that in a **non-login,
     non-interactive** shell — which is the shell a station is given — the shim is **not** on `PATH`,
     so the ban is **remembered, not mechanical**;
   - names the three outcomes the installer can report, not two: install failed, `INSTALLED BUT
     INERT` (exit 2), and install-and-reachable — and says that the middle one is a FINDING to quote
     and carry on from, exactly as the current text says of a failure;
   - carries the `PATH="…/.local/bin:$PATH" git <args>` one-call form verbatim, as the only
     protection available inside a station's own shell;
   - keeps, unchanged, the existing rule that a station never runs `git` against a mounted folder and
     never treats a missing guard as licence to do so.
2. Re-record the block's hash in `docs/pipeline/stations/_canonical-blocks.json` **in the same PR**.
   `scripts/pipeline/lint-station.mjs` hard-fails any edit to a canonical block whose hash was not
   re-recorded; run it and make it pass before opening the PR.
3. `git mv docs/pr-prompts/pr-preflight-guard-claim-outlives-its-own-fix-HOLD.md
   docs/pr-prompts/superseded/` in the same PR.
4. Title the PR `docs(station): <summary>`.

## Do NOT

- Do **not** change `scripts/pipeline/vm-git-guard.sh`. The script is correct; #2065 is what made it
  honest, and this prompt exists only because the documentation did not move with it.
- Do **not** edit `DOCTRINE.md` §9.2 — its *"never run `git` through the device bridge"* bullet is
  still exactly right and is not what drifted.
- Do **not** touch `/sot/` (Station 05's, CP-24), any file under `apps/`, `scripts/`, `packages/`, or
  any `.github/` workflow.
- Do **not** let the seven copies diverge. The block is byte-identical by design; edit it once and
  apply the same bytes to all seven, or `lint-station.mjs` will fail.
- Do **not** re-word the Azure / Entra / SharePoint hard stop or the RULE 1 paragraph that follow it.

## Guardrails

- One attempt. Never exit silently — say `NO-OP: <reason>` if you do nothing.
- Never ask a question or stand by for approval. There is no human in this run.
- Read the job log before diagnosing any CI failure; never reason one out of the diff.
- Edit these documents with node (`readFileSync` / `writeFileSync`, utf8), not PowerShell
  `Set-Content` / `Out-File` — DOCTRINE §9.3. Pass a **function** to `String.replace`, never a
  replacement string, and assert the byte delta of every file you touch.

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

## Falsifying probe

`grep -rc "persists itself onto" docs/pipeline/stations/` at `origin/main`. It returns **1 per
station doc, seven files** today ([MEASURED] 2026-09-22T06:2xZ at `447bff3b`; NEGATIVE control, a
needle minted this run, returned 0 files). If it ever returns 0 before this prompt runs, the work
landed by another route and the premise is spent — bin it.
