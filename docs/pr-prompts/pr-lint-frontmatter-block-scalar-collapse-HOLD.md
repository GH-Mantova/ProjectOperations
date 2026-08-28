---
premise: '! grep -q "foldBlockScalar" scripts/pipeline/lint-prompt.mjs'
premise_means: 'parseFrontMatter() does not fold YAML block scalars, so any field written as ">-" or "|" returns the bare indicator string instead of its text.'
scope:
  - scripts/pipeline/lint-prompt.mjs
  - scripts/pipeline/test-lint-prompt.mjs
done_when: 'node scripts/pipeline/test-lint-prompt.mjs && grep -q "foldBlockScalar" scripts/pipeline/lint-prompt.mjs && grep -q "block scalar" scripts/pipeline/test-lint-prompt.mjs'
size: 2
gate_allow: none
seed_only: false
escalates: false
backfill: false
rollback_strategy: 'Two script files, no schema and no runtime path. Revert is a single git revert; the watcher does not use this parser (it has its own folding extractor at scripts/pr-watcher/index.mjs:496-513), so a revert cannot change dequeue behaviour.'
---

# `parseFrontMatter` collapses YAML block scalars, and it rubber-stamps the LL-29 rollback gate

## The defect, MEASURED at `origin/main 82ba8538` (2026-08-28T10:30Z, Station 04)

`scripts/pipeline/lint-prompt.mjs:922 parseFrontMatter()` reads a front-matter value as the
remainder of the `key:` line. When the value is a YAML **block scalar**, that remainder is the
indicator itself — `>-` or `|` — and the folded body on the following indented lines is discarded.
The function returns the two-character string `">-"` as the field's value.

Probed directly against the exported function:

```
$ node -e "import('.../lint-prompt.mjs').then(m => ...)"  # docs/pr-prompts/pr-comms-hub-inbox-HOLD.md
   premise="! test -f apps/web/src/pages/crm/comms-inbox.helpers.ts"   <- inline, parsed correctly
   premise_means=">-"
   done_when=">-"
   rollback_strategy=">-"
```

Positive control, same probe, same run — `pr-ci-windows-pipeline-tests-HOLD.md`, whose fields are
inline: every field parsed to its real text, and its genuinely absent `rollback_strategy` came back
`<absent>`. **The parser distinguishes absent from present; block scalars are the blind spot.**

## Blast radius — measured across all 86 parseable prompts in `docs/pr-prompts/`

| field | collapsed to a bare indicator |
|---|---|
| `premise` | **0** |
| `premise_means` | 30 |
| `done_when` | 21 |
| `rollback_strategy` | **13** |

`premise: 0` is the important number: **no prompt was ever wrongly binned by this.** The premise
field is written inline everywhere, so the STALE/exit-3 decision is not affected. Do not widen this
prompt into a premise-integrity investigation — that question is already answered.

## Why it matters — one real gate, reduced to a rubber stamp

**`lint-prompt.mjs:1241-1252` is the LL-29 migration-rollback gate**: for a prompt whose `scope`
touches `prisma/migrations`, it demands `rollback_strategy` be present and non-empty. It reads
`const rb = fm.rollback_strategy` (:1245). A collapsed `">-"` is neither missing nor empty, **so the
gate passes without ever reading the rollback strategy.**

Three of the 13 affected prompts are exactly the class LL-29 exists to protect:

- `pr-524-rates-b-slice2-canonical-HOLD.md` — irreversible table drop
- `pr-rates-s11c-drop-legacy-tables-HOLD.md` — drops the legacy rate tables
- `pr-siteid-notnull-backfill-HOLD.md` — data backfill

Secondary, and deliberately stated as smaller than it looks: `:1315` and `:1322` fold
`String(fm.done_when || "")` into the destructive-pattern corpus, so for those 21 prompts the corpus
gets `">-"` instead of the acceptance command. The same corpus also includes the whole stripped
body, so a destructive instruction written in prose is still caught. **The only thing that can now
evade the scan is a destructive command that appears solely inside a folded `done_when` and nowhere
in the body.** Narrow, but real.

Third: `:1423` renders the exit-3 verdict as `'Premise no longer holds: "' + fm.premise_means + '"'`.
For **9 of the 21 currently-STALE prompts** that prints the literal `Premise no longer holds: ">-"`,
a verdict no operator can re-check — DOCTRINE §7.1 requires a factual line to carry enough output to
re-verify it.

## What is NOT affected — check this before escalating

- **The watcher runtime is fine.** `scripts/pr-watcher/index.mjs:496-513` has its own `done_when`
  extractor whose comment states it *"Handles inline scalars, folded/literal block scalars
  (`done_when: >-` / `|`), and simple list forms."* Dequeue and lane-pinning read the real text.
  This is a **linter-side** defect, not a runtime one.
- **No prompt was mis-binned** (`premise` collapse count = 0).

## The work

1. In `scripts/pipeline/lint-prompt.mjs`, add a `foldBlockScalar()` helper and call it from
   `parseFrontMatter()` whenever a value is exactly `>`, `>-`, `>+`, `|`, `|-` or `|+`: consume the
   following lines that are more-indented than the key, strip that common indent, and join them —
   spaces for `>` (folded), newlines for `|` (literal). Honour the chomping suffix (`-` strips the
   trailing newline, `+` keeps it, bare keeps exactly one).
2. Keep the existing inline-scalar path byte-for-byte unchanged. **Every one of the 67 existing
   tests must still pass** — they encode the current contract and are the regression net.
3. Add tests to `scripts/pipeline/test-lint-prompt.mjs` covering, at minimum: a folded `>-`
   `rollback_strategy` on a `prisma/migrations`-scoped prompt is read as its real text (and an
   empty/whitespace-only folded block is correctly rejected by the LL-29 gate at :1241); a folded
   `done_when` reaches the destructive-pattern corpus; and a literal `|` block preserves newlines.
   At least one test file must contain the words `block scalar` so `done_when` can gate on it.
4. Do **not** rewrite any prompt file in `docs/pr-prompts/`. This prompt fixes the reader, not the
   87 documents it reads. Rewriting them is a separate, larger, and much riskier change.

## Scope discipline

Two files. Nothing under `apps/`, nothing under `sot/`, no schema, no migration, no seed. If the fix
appears to need a third file, stop and report rather than widening — a linter change that grows into
the prompt corpus is how a one-file fix becomes a board-wide outage.

`gate_allow: none` is correct: no migration, no env var, no dependency. CP-24 is satisfied because
this touches `scripts/` only and no `sot/` path.

## STANDING AUTHORITY

You have STANDING AUTHORITY to finish the work, commit, push, open the PR and drive it green. Do not
stop to ask permission for work inside the scope above. If `node scripts/pipeline/test-lint-prompt.mjs`
goes red, read the failing case and fix the cause — never weaken or delete an existing assertion to
get green, because those 67 tests are the only thing standing between this parser and the queue.
