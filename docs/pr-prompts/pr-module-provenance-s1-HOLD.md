---
premise: '! grep -q "deriveModule" scripts/pipeline/lint-prompt.mjs'
premise_means: >-
  Nothing records which module a prompt belongs to, and nothing can tell which of the three PR
  Masters produced it. Measured 2026-09-01 on origin/main at b30e166a - across the last 40 merged
  PRs there are 24 distinct conventional-commit scopes, and SIX of them mean "crm" (crm-s8, crm-s9,
  crm-s10, crm-s11, crm-s12, crm-wincount-slice3), two mean "rates" (rates, rates-s5) and two mean
  "scope" (scope, scope-cards). The five most common scopes are pipeline internals, not modules at
  all. The scope is invented by the build agent - there is no "gh pr create" anywhere in
  scripts/pr-watcher/, PROMPT-SCHEMA.md says nothing about PR titles, and no CI job checks them - so
  three independent gaps let it drift. The arming log cannot close the gap either - every entry
  reads by=Marco@ regardless of which actor armed it.
scope:
  - scripts/pipeline/lint-prompt.mjs
  - scripts/pipeline/module-baseline.json
  - docs/pr-prompts/PROMPT-SCHEMA.md
  - scripts/pipeline/__tests__/lint-prompt-module.test.mjs
done_when: >-
  grep -q "deriveModule" scripts/pipeline/lint-prompt.mjs && grep -q "MODULE_AMBIGUOUS"
  scripts/pipeline/lint-prompt.mjs && test -f scripts/pipeline/module-baseline.json && grep -q
  "module:" docs/pr-prompts/PROMPT-SCHEMA.md
size: 4
gate_allow: none
seed_only: false
escalates: false
backfill: false
---

# Every prompt should say which module it belongs to - and 72% can already answer without being asked

## The problem, measured

You cannot tell which module a PR belongs to by looking at it, and you cannot tell which actor
produced it at all.

**[MEASURED] 2026-09-01, origin/main b30e166a, last 40 merged PRs - 24 distinct scopes:**

```
 5  board      5  pipeline   4  pr-prompts  3  watcher   3  doctrine
 2  scope      1  rates      1  rates-s5    1  sweep     1  scope-cards
 1  crm-s8  1  crm-s9  1  crm-s10  1  crm-s11  1  crm-s12  1  crm-wincount-slice3
```

Six scopes mean **crm**. Two mean **rates**. Two mean **scope**. The five most common are pipeline
internals rather than product modules.

**[MEASURED] Three independent reasons it drifts:**

1. `git grep -n "pr create" origin/main -- scripts/` returns **no hit in `scripts/pr-watcher/`** -
   the watcher never titles a PR. The build agent runs `gh pr create` itself and invents the title.
2. `PROMPT-SCHEMA.md` contains no guidance on PR titles.
3. `.github/` contains no title check - no commitlint, no semantic-pull-request, nothing.

**[MEASURED] And the arming log cannot supply provenance.** Every line reads `by=Marco@` - the
Windows account, not the actor. With three PR Masters plus Station 00 arming, four actors are
indistinguishable in the only record that exists.

## The insight this slice is built on

**Prompts already carry the answer.** Every prompt declares `scope:` - a list of file paths. The
module is derivable from it, provided the incidental paths are ranked out: nearly every feature
touches `apps/api/prisma/**` and its own `docs/**`, so those must never win over a product module.

**[MEASURED] over all 107 tracked HOLD/ready prompts on origin/main (excluding superseded/ and
archive/), with `prisma`, `docs`, `board`, `ci`, `e2e`, `sot` demoted as incidental:**

```
ONE product module after ranking  : 63
still ambiguous (author must pick): 24
incidental-only (docs/pipeline)   : 14
unresolvable                      :  6
DERIVABLE WITHOUT THE AUTHOR      : 77 of 107  (72%)
```

Naive derivation - not ranking the incidentals out - gives only 43 of 107 and is NOT good enough;
that was measured first and rejected. The 24 that remain ambiguous are genuinely ambiguous
(`procurement + projects`, `compliance + workers + email`, `jobs + field`, `rates + estimates +
admin`) and a machine must not pick for them.

## What to build

### 1. `deriveModule(scopePaths)` in `scripts/pipeline/lint-prompt.mjs`

A pure, exported, unit-testable function. Given the prompt's `scope` list it returns
`{ module, source, candidates }`.

**The vocabulary is DERIVED, never hand-listed.** Read the directory names under
`apps/api/src/modules/` and `apps/web/src/pages/` from the repo at run time. A hand-maintained list
of 81 modules goes stale the day someone adds the 82nd and fails OPEN - that is the same defect
class as `pr-statussweep-orphan-worktree-dirs`, retired 2026-09-01 for keying on a name instead of
behaviour.

Path resolution, first match wins:

```
apps/api/src/modules/<X>/...   -> X
apps/web/src/pages/<X>/...     -> X
apps/api/prisma/...            -> prisma      (INCIDENTAL)
scripts/pr-watcher/...         -> watcher
scripts/...                    -> pipeline
.github/...                    -> ci          (INCIDENTAL)
tests/e2e/...                  -> e2e         (INCIDENTAL)
sot/...                        -> sot         (INCIDENTAL)
docs/pr-prompts/...            -> board       (INCIDENTAL)
docs/...                       -> docs        (INCIDENTAL)
anything else                  -> null
```

A path segment containing `*` is NOT a module name - `apps/web/src/**` must resolve to null, not to
`**`. The first measurement pass produced `**` as a module and that is how the bug would ship.

Then: drop nulls, dedupe, remove INCIDENTAL entries. Exactly one left -> that is the module,
`source: "derived"`. None left but incidentals present -> the sole incidental is the module
(a genuinely docs-only or pipeline-only prompt). More than one, or nothing at all -> ambiguous.

### 2. Front matter gains an OPTIONAL `module:` that OVERRIDES

- Absent + derivation unambiguous -> use the derived value. **72% of the corpus needs no edit.**
- Present -> the declared value wins, and it must be in the derived vocabulary.
- Present AND disagrees with a confident derivation -> report `MODULE_MISMATCH` naming both.
  🔴 This check is the load-bearing half. `parseFrontMatter` silently ignores keys it does not
  know, so without it `moduel:` drops on the floor and the provenance vanishes without a word -
  the exact failure the dependency-key code warns about in-file at `lint-prompt.mjs:1286`.
- Ambiguous derivation and no `module:` -> `MODULE_AMBIGUOUS`, listing the candidates so the author
  can paste one in.

### 3. The RATCHET - `scripts/pipeline/module-baseline.json`

🔴 **This is what stops the slice damaging staged work.** 30 of the 107 staged prompts cannot
self-resolve. Hard-failing them would break them at ARM time - burning an arm each, with a human
present expecting a build.

Generate the baseline once: every prompt name that is currently ambiguous or unresolvable. Then:

- name IS in the baseline -> `MODULE_AMBIGUOUS` is a **WARNING**; the prompt still lints ADMIT.
- name is NOT in the baseline -> it is an **ERROR**; the prompt is rejected.

So every existing prompt arms exactly as it does today, every new prompt must be unambiguous from
birth, and the baseline can only shrink. This mirrors `docs/qa/sot-refs-baseline.json`, which CI
already ratchets against - use the same shape so there is one pattern here, not two.

Include a one-line comment in the JSON saying it is a ratchet, that entries may be removed but
never added, and what to do instead (add `module:` to the prompt).

### 4. Document it in `PROMPT-SCHEMA.md`

Add `module` to the front-matter reference: optional, derived from `scope` when unambiguous,
required when not, and the value that will become the PR title's scope in the next slice. Keep it
to one short subsection.

## Prove it before you believe it

- Run the derivation over all 107 tracked prompts and paste the four counts. They must match
  63 / 24 / 14 / 6. **A different distribution means the ranking is wrong - stop and say so rather
  than adjusting the baseline to fit.**
- Positive control: a prompt whose scope is only `apps/api/src/modules/crm/**` derives `crm`.
- Negative control: a scope of only `apps/web/src/**` derives **null**, not `**`.
- Ratchet control: a NEW ambiguous prompt (not in the baseline) must be REJECTED, and a baselined
  one must ADMIT with a warning. Show both.
- Re-lint at least 10 existing HOLD prompts and show they still ADMIT.

## Guard against the obvious way of getting this wrong

- Do NOT hand-write the module vocabulary. Derive it from the directory listing.
- Do NOT make `module:` required. That breaks 30 staged prompts at arm time.
- Do NOT add entries to the baseline as a way of silencing a new prompt - it is a ratchet, and a
  growing baseline is the gate failing open.
- Do NOT alter any existing lint failure code or its exit semantics. Other stations parse them.
- `parseFrontMatter` folds block scalars correctly since #1414 - do not re-implement YAML.

## Do NOT

- Do NOT touch `scripts/pr-watcher/**`. The watcher does not title PRs and is not part of this.
- Do NOT add a CI gate on PR titles - that is the NEXT slice and it chains on this one.
- Do NOT edit any existing prompt to add `module:`. Backfill is not this slice's job, and editing
  staged prompts risks the queue.
- Do NOT touch `/sot/`, `apps/**`, `prisma/**`, or any file outside `scope`.
- Do NOT run `git checkout .`, `checkout -- <dir>`, `reset --hard`, `stash pop` or `git clean`.

## VERIFY

```
node scripts/pipeline/lint-prompt.mjs docs/pr-prompts/pr-module-provenance-s1-ready.md
node --test scripts/pipeline/__tests__/lint-prompt-module.test.mjs
grep -q "deriveModule" scripts/pipeline/lint-prompt.mjs
grep -q "MODULE_AMBIGUOUS" scripts/pipeline/lint-prompt.mjs
test -f scripts/pipeline/module-baseline.json
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
