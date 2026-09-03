---
premise: '! grep -q "vm-git-guard" docs/pipeline/stations/00-supervisor.md'
premise_means: >-
  PREFLIGHT step 1 tells every station to load the tool schema and reach the box, but never
  tells it to install the device-bridge git guard. The guard is therefore opt-in: any station
  or lane that skips the installer can still leave a 0-byte index.lock and freeze the board.
  Seven occurrences; three documentation bullets did not prevent the seventh.
scope:
  - docs/pipeline/stations/00-supervisor.md
  - docs/pipeline/stations/01-code-writer.md
  - docs/pipeline/stations/02-board-driver.md
  - docs/pipeline/stations/03-machine-minder.md
  - docs/pipeline/stations/04-scanner.md
  - docs/pipeline/stations/05-sot-keeper.md
  - docs/pipeline/stations/06-pr-master.md
  - docs/pipeline/stations/_canonical-blocks.json
done_when: >-
  node scripts/pipeline/lint-station.mjs && grep -c "vm-git-guard" docs/pipeline/stations/0*.md | grep -cv ":0$" | grep -q "^7$"
size: 8
gate_allow: none
seed_only: false
escalates: false
cluster: vm-git-guard
cluster_order: 2
requires_on_main: scripts/pipeline/vm-git-guard.sh :: ensure_on_path
---

# VM-GUARD-S2: PREFLIGHT installs the guard, so it stops being opt-in

**Grounded against `origin/main` = `f5c01415`, measured 2026-09-03.**

Decided by Marco 2026-09-03: option (a) on the device-bridge index-lock escalation. S1 made
the installer persist itself onto PATH; this slice makes every station run it.

## 🔴 This edits a hash-gated canonical block. Read this before touching anything.

The text you are changing is inside `<!-- CANONICAL-BLOCK: station-contract v2 -->`, which
`scripts/pipeline/lint-station.mjs` requires to be **byte-identical across all seven station
docs** and to match a recorded hash. As at `f5c01415` the recorded state is:

```
station-contract   version 2   sha 73ad6cc7ef1a2dd5
```

So this slice is **v2 → v3**, and it fails CI in four different ways if done carelessly:

1. Edit fewer than seven docs → `has been EDITED (sha …)` on the ones you missed.
2. Edit all seven but not identically → the same, on whichever drifted.
3. Bump the open marker and not the close marker → `open/close markers disagree on version`.
4. Bump both and not re-record → `is v3, the recorded contract is v2`.

**The order that works:** edit all seven identically, bump **both** markers to `v3` in all
seven, then run `node scripts/pipeline/lint-station.mjs --write-canonical` to re-record, then
run the linter plain and require exit 0. Read every one of the seven files back and compare
the block byte-for-byte before you commit — #1519 did exactly this for v1 → v2 and its method
is the one to copy.

## Do

1. **In PREFLIGHT step 1, after the `ToolSearch` paragraph and before "Then start a shell on
   the Windows host", insert one short paragraph** instructing the station to install the
   device-bridge git guard as its first VM-side act:

   > **Install the git guard before any VM-side call.** Run
   > `bash "$HOME/mnt/ProjectOperations2/scripts/pipeline/vm-git-guard.sh"` once, at the top of
   > the run. It is idempotent and persists itself onto `PATH`. It refuses `git` only against a
   > mounted folder — a cut-short call there leaves a 0-byte `index.lock` with no owning Windows
   > process, which never expires and freezes every station (DOCTRINE §9.2, seven occurrences).
   > **If the installer fails, say so in your report and carry on** — a guard that cannot install
   > is a finding, not a reason to stop. Do not substitute your own `git` calls against the mount.

2. **Bump the block markers to v3** — both the opening `CANONICAL-BLOCK: station-contract v2`
   and the closing `END-CANONICAL-BLOCK: station-contract v2` — in **all seven** files.
3. **Re-record** `_canonical-blocks.json` with `--write-canonical`. Only the
   `station-contract` entry may change; `instruments` must stay `version 2 / b1030c0065d5d970`.
4. **Leave `contract_version` in the front matter at 1** in all seven files. The scheduled-task
   bootstraps declare `station_doc_version: 1` and a mismatch makes every station run READ-ONLY.
   This is a change to the block's own version, not to the station contract version.

## Do NOT

- Do NOT make a failed install a STOP condition. The STOP contract belongs to an unreachable
  machine, and widening it would turn a missing bash script into a frozen board — the very
  failure this whole chain exists to remove.
- Do NOT edit the STOP blockquote, the `ToolSearch` paragraph, or any other part of the block.
- Do NOT touch `contract_version` or `station_doc_version` in any front matter.
- Do NOT edit `scripts/pipeline/vm-git-guard.sh` — S1 owns it.
- Do NOT touch `sot/`.

## Verify

- `node scripts/pipeline/lint-station.mjs` exits 0.
- All seven docs contain `vm-git-guard` exactly once; `grep -c` returns 1 for each.
- All seven carry `station-contract v3` on **both** markers, and no `v2` marker survives:
  `grep -c "station-contract v2" docs/pipeline/stations/*.md` returns 0 everywhere.
- `_canonical-blocks.json` shows `station-contract` at version 3 with a new sha, and
  `instruments` unchanged at version 2 / `b1030c0065d5d970`.
- `contract_version: 1` still present in all seven front matters.
- Control: re-run the linter after reverting one file's block — it must REJECT. A linter that
  passes whatever it is given is not evidence.
- The `pipeline-tests` CI job passes.

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

Every scope limit stated above still applies. A scope limit is **not** a reason to stop
before pushing.
