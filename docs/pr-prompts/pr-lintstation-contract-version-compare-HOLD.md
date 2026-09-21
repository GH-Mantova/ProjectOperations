---
premise: grep -q "declare a different station_doc_version" scripts/pipeline/lint-station.mjs
premise_means: lint-station.mjs still compares each station doc's station_doc_version against the canonical station-contract version, so it prints a false mismatch for all seven station docs and tells the reader to go read-only.
scope:
  - scripts/pipeline/lint-station.mjs
  - docs/pipeline/stations/00-supervisor.md
  - docs/pipeline/stations/01-code-writer.md
  - docs/pipeline/stations/02-board-driver.md
  - docs/pipeline/stations/03-machine-minder.md
  - docs/pipeline/stations/04-scanner.md
  - docs/pipeline/stations/05-sot-keeper.md
  - docs/pipeline/stations/06-pr-master.md
  - docs/pr-prompts/superseded/pr-lintstation-contract-version-compare-HOLD.md
done_when: node scripts/pipeline/lint-station.mjs && ! node scripts/pipeline/lint-station.mjs 2>&1 | grep -q "declare a different station_doc_version" && ! test -f docs/pr-prompts/pr-lintstation-contract-version-compare-HOLD.md
size: 4
gate_allow: none
seed_only: false
escalates: false
rollback_strategy: ''
module: ''
---

# lint-station.mjs compares the wrong version field, and prints an instruction this pipeline disproved

## The defect

`scripts/pipeline/lint-station.mjs` ends its run with a NOTE block that compares the WRONG two
numbers, then gives advice that would send every station read-only.

Line 170 builds the version map from **`station_doc_version`**:

```js
return { file, fails, warns, version: fm2 ? Number(fm2.station_doc_version) : null };
```

Lines 221-227 then compare that map against the **canonical block's** contract version:

```js
const contractV = canon['station-contract']?.version;          // 3
const off = [...versions.entries()].filter(([, v]) => v !== contractV);
if (contractV && off.length) {
  console.log(C.yel('NOTE  ') + `  contract is v${contractV}; these declare a different station_doc_version:`);
  for (const [f, v] of off) console.log(`          ... -> v${v}`);
  console.log(C.dim('          the scheduled-task bootstrap must declare the same number, or the run goes read-only'));
}
```

`station_doc_version` and the canonical `station-contract` version are different quantities. They
have never been equal and are not meant to be. So the filter matches **all seven** station docs,
every single run.

## Why this is S2 and not cosmetic

The PREFLIGHT contract that is byte-identical in all seven station docs says:

> **If doc version and bootstrap disagree, say so in your first line and run READ-ONLY for the rest
> of the run.**

The NOTE tells the reader the bootstrap "must declare the same number" as the contract — i.e. 3.
Every bootstrap under `C:\Users\Marco\Claude\Scheduled\` declares `station_doc_version: 1`, which
correctly matches its station doc. A station that obeys the printed line compares 1 against 3,
concludes a mismatch, and goes READ-ONLY for a whole run — for a defect that does not exist.

This is the drift-detection tool itself emitting an instruction the pipeline has disproved, which is
the exact class the instruction-drift sweep exists to catch.

It is silent in CI: `lint-station.mjs` runs at `.github/workflows/ci.yml:229`, exits **0**, and
prints `ADMIT: all 8 docs clean` on the same run as the false NOTE.

## Second half: `contract_version` is a dead field, and it is stale

`contract_version` is read in exactly one place — a presence/integer check at line 122:

```js
for (const k of ['station_doc_version', 'contract_version']) {
  const v = Number(fm[k]);
  if (!Number.isInteger(v) || v < 1) fails.push(...);
}
```

Nothing ever compares it to anything. All seven station docs declare `contract_version: 1` while
`_canonical-blocks.json` records `station-contract` at **version 3**. The field that was presumably
meant to track the contract has silently sat two versions behind since the contract moved to v3.

## The work

1. In `lint-station.mjs`, make the NOTE compare **`contract_version`** against
   `canon['station-contract'].version` — not `station_doc_version`. Keep the existing
   `station_doc_version` value on the ADMIT lines (`(v1)`) as-is; that part is correct and useful.
2. Rewrite the advice line so it describes what a mismatch actually means: the station doc's
   embedded contract block is out of step with the recorded canonical contract, and the doc needs
   re-syncing. **Do not** tell the reader anything about the scheduled-task bootstrap here — the
   bootstrap-vs-doc comparison is `station_doc_version`, and the PREFLIGHT contract already owns
   that rule.
3. Bump `contract_version:` from `1` to `3` in the front matter of all seven station docs so the
   corrected comparison passes. This is a front-matter-only edit; **do not touch the canonical
   block body** — it is byte-identical across all seven by design and `lint-station` hard-fails any
   edit to it (sha check, line 140).
4. Re-run `node scripts/pipeline/lint-station.mjs` and confirm it exits 0 with no NOTE block.

## Scope discipline (LL-30)

Front matter only in the seven station docs. No prose edits, no canonical-block edits, no `sot/`
files — CP-24 hard-fails any PR mixing code and `sot/`, and this PR already carries a `scripts/`
change.

## Evidence

- [MEASURED] 2026-09-21T06:12Z at `origin/main f885dc04`, dev tree `main @ 29abf8d4`:
  `node scripts/pipeline/lint-station.mjs` → `ADMIT: all 8 docs clean`, `EXIT=0`, and a NOTE block
  listing all seven station docs as `-> v1`. Reproduced twice, identical both times.
- [MEASURED] front matter of all seven docs on `origin/main`:
  `station_doc_version=1 contract_version=1`, every one.
- [MEASURED] `git show origin/main:docs/pipeline/stations/_canonical-blocks.json` →
  `"station-contract": { "version": 3, "sha": "954c7f49160daa71" }`.
- [MEASURED] every bootstrap under `C:\Users\Marco\Claude\Scheduled\` declares
  `station_doc_version: 1` — so bootstrap and doc agree, and no station should be read-only.
- [MEASURED] `.github/workflows/ci.yml:229` runs the linter; exit 0 means CI never surfaces this.
- History checked: no open PR, staged prompt or HOLD covers it. The three existing `lint-station`
  mentions in `docs/pr-prompts/` (`queue-watch-state.md:289,346,391`) record ADMIT counts only;
  `pr-queue-layout-sot-entry-HOLD.md:6,57` merely invokes the command.

STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.

Staged by Station 04 (read-only on the board) as a HOLD. **Arming is Station 00's, on Marco's
authority.**
