---
premise: '! grep -q "check-pr-title" .github/workflows/ci.yml'
premise_means: >-
  Nothing checks a PR title. Measured 2026-09-01 on origin/main at b30e166a - there is no
  "gh pr create" anywhere in scripts/pr-watcher/, so the build agent invents its own title;
  PROMPT-SCHEMA.md gives no guidance; and .github/ contains no commitlint, no
  semantic-pull-request and no title job. The result is 24 distinct scopes across the last 40
  merged PRs, six of which mean "crm". Slice 1 gives every prompt a validated module; without this
  slice that module never reaches GitHub, so the board still cannot be read by module.
requires_on_main:
  - scripts/pipeline/lint-prompt.mjs :: deriveModule
scope:
  - scripts/pipeline/check-pr-title.mjs
  - scripts/pipeline/title-scope-baseline.json
  - .github/workflows/ci.yml
  - docs/pr-prompts/PROMPT-SCHEMA.md
done_when: >-
  grep -q "check-pr-title" .github/workflows/ci.yml && node
  scripts/pipeline/check-pr-title.mjs --self-test
size: 4
gate_allow: none
seed_only: false
escalates: false
backfill: false
---

# A PR title must name its module - and a naive gate would reject 62% of what this repo produces

## What was measured before designing this

**[MEASURED] 2026-09-01, origin/main b30e166a.** A gate accepting only exact module folder names
(81 under `apps/api/src/modules/` + 59 under `apps/web/src/pages/` + 8 named areas = 123 values)
was tested against real titles:

```
OPEN  #1477 FAIL "export"      #1478 FAIL "scope-sub"   #1480 FAIL "pr-prompts"   #1479 PASS "board"
MERGED, last 40:  would pass 15,  would FAIL 25  (62%)
```

**A gate that fails 62% of legitimate work is not a gate, it is an outage.** A red required check
leaves the watcher in merge-wait and burns the slice. So the naive design is REJECTED, and this
prompt exists because of that measurement, not despite it.

The 25 failures are three families:

| family | examples | count | fix |
|---|---|---|---|
| module + slice suffix | `crm-s8`..`crm-s12`, `rates-s5`, `pipeline-hygiene-s3` | 9 | NORMALISE |
| real pipeline areas, list too short | `pr-prompts`, `doctrine`, `sweep`, `lint-prompt`, `agents`, `status-sweep`, `station06` | 12 | WIDEN |
| genuinely unresolvable today | `scope`, `scope-cards`, `pricing`, `export`, `crm-wincount-slice3` | ~5 | RATCHET |

## What to build

### 1. `scripts/pipeline/check-pr-title.mjs` (new)

Node built-ins only. Exit **0** pass, **1** violation, **2** `[CANNOT MEASURE]`. Model it on
`scripts/pipeline/check-agent-doctrine.mjs`, which is already wired into the same CI job.

**Vocabulary — IMPORT, do not duplicate.** Slice 1 put the derivation in
`scripts/pipeline/lint-prompt.mjs`; import its exported vocabulary/`deriveModule` helper so there is
ONE source of truth. Two copies of a module list is the drift this whole chain exists to stop.

**Two checks, in order:**

**(a) STRUCTURE — always binding.** The title must match
`^(feat|fix|docs|test|chore|refactor|perf|build|ci|style|revert)\(([^)]+)\):\s+\S`.
All 40 sampled titles already satisfy this, so it costs nothing and catches a genuinely malformed
title.

**(b) SCOPE RESOLVES — binding, with normalisation and a ratchet.**
Normalise before looking up: strip a trailing slice suffix matching `-(s\d+|slice\d+)$`, so
`crm-s11` -> `crm` and `rates-s5` -> `rates`. Apply it ONCE, not repeatedly.
Then accept the scope if the normalised value is in the vocabulary, or the raw value is in the
baseline (below). Otherwise fail, and **print the failure usefully**: the scope seen, the
normalised form, and the nearest 5 vocabulary entries by edit distance. A gate that says only
"invalid" will be worked around rather than obeyed.

**Named areas must cover what the pipeline actually produces.** At minimum:
`pipeline, watcher, board, docs, sot, ci, e2e, prisma, pr-prompts, doctrine, sweep, status-sweep,
lint-prompt, agents, station`. Derive nothing you can measure - but these have no folder to read,
so they are explicit. Keep them in one array with a comment saying why each family is there.

**Where the title comes from in CI:** the PR title is not in the checkout. Read
`process.env.PR_TITLE`, supplied by the workflow. If it is absent or empty, exit **2**
`[CANNOT MEASURE] PR_TITLE not set` - never exit 0. A title check that silently passes when it
cannot see the title is worse than no check.

**Internal controls, printed on every run (DOCTRINE section 7):**
- positive: `feat(crm): x` passes; `feat(crm-s11): x` passes via normalisation.
- negative: `feat(zzznotamodule): x` fails; `no scope here` fails on structure.
- If either control gives the wrong answer, exit **2**. A checker whose controls are silent is a
  checker nobody can trust.

**`--self-test`** runs only the controls, needs no `PR_TITLE`, and exits 0 when they all behave.
`done_when` calls it.

### 2. `scripts/pipeline/title-scope-baseline.json`

The ratchet, same shape and spirit as `docs/qa/sot-refs-baseline.json`. Seed it ONLY with scopes
measured in use today that do not resolve: `scope`, `scope-cards`, `scope-sub`, `pricing`,
`export`, `crm-wincount-slice3`. Each entry carries a one-line note saying what it should become
(e.g. `export -> estimate-export`).

🔴 **Entries may be REMOVED, never added.** A growing baseline is the gate failing open. Put that
sentence in the file.

### 3. Wire it into CI

`.github/workflows/ci.yml` already runs `node scripts/pipeline/check-agent-doctrine.mjs` at line
187 in the pipeline-tests job. Add the title check to that same job with the title passed through:

```yaml
      - run: node scripts/pipeline/check-pr-title.mjs
        env:
          PR_TITLE: ${{ github.event.pull_request.title }}
```

Guard it so it is skipped on `push` events, where there is no PR title - a `push` run must not
exit 2 and turn main red.

🔴 **Do NOT make it a required status check.** Branch protection is Marco's, and adding a required
check retroactively blocks every open PR. Say in the PR body that he can promote it once the open
PRs are retitled.

### 4. Document the convention in `PROMPT-SCHEMA.md`

One short subsection: the PR title is `<type>(<module>): <summary>`, the module is the prompt's
`module` field from slice 1, and slice suffixes are tolerated but discouraged. Prompts should tell
their agent to title the PR this way - that is what makes new PRs correct by construction rather
than by gate.

## Prove it before you believe it

- Run the checker against the **last 40 merged titles** and paste pass/fail. With normalisation and
  the widened areas it must reach **>= 34 of 40**. **If it does not, the area list is still too
  short - widen it rather than growing the baseline.**
- Run it against the open PRs and paste the result. `#1479` must pass unchanged.
- Paste both control outcomes from a real run.
- Show a `push`-event run exiting 0, not 2.

## Guard against the obvious way of getting this wrong

- Do NOT re-implement the module vocabulary. Import slice 1's.
- Do NOT silence a failure by adding to the baseline. Widen the areas, or fix the title.
- Do NOT normalise repeatedly - `crm-s1-s2` is a malformed scope, not `crm`.
- Do NOT judge merged PRs. CI runs per PR; history is not re-litigated and must not be rewritten.
- Do NOT use `--jq` from PowerShell to read titles (DOCTRINE 9.4). CI is bash; the env var is the
  supported path.

## Do NOT

- Do NOT edit `scripts/pipeline/lint-prompt.mjs` - slice 1 owns it, and editing it here creates the
  collision the split exists to prevent.
- Do NOT retitle any existing PR as part of this work. Say in the PR body which open PRs will fail
  and leave the retitling to Marco.
- Do NOT add the check to any job other than the existing pipeline-tests job.
- Do NOT touch `/sot/`, `apps/**`, `prisma/**`, or any file outside `scope`.
- Do NOT run `git checkout .`, `checkout -- <dir>`, `reset --hard`, `stash pop` or `git clean`.

## VERIFY

```
node scripts/pipeline/lint-prompt.mjs docs/pr-prompts/pr-module-provenance-s2-ready.md
node scripts/pipeline/check-pr-title.mjs --self-test
grep -q "check-pr-title" .github/workflows/ci.yml
test -f scripts/pipeline/title-scope-baseline.json
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
