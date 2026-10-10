---
premise: '! grep -q "SPENT_HOLD_PR_OPEN" scripts/pipeline/lint-prompt.mjs'
premise_means: lint-prompt.mjs has no check for a HOLD whose own work is already sitting in an open PR, so such a prompt lints ADMIT and is armable a second time.
scope:
  - scripts/pipeline/lint-prompt.mjs
  - scripts/pipeline/__tests__/lint-prompt-spent-hold.test.mjs
  - docs/pr-prompts/superseded/pr-lint-prompt-refuse-a-hold-whose-pr-is-open-HOLD.md
done_when: pnpm lint && node --test scripts/pipeline/__tests__/lint-prompt-spent-hold.test.mjs && grep -q "SPENT_HOLD_PR_OPEN" scripts/pipeline/lint-prompt.mjs
size: 3
gate_allow: none
seed_only: false
escalates: false
module: pipeline
---

# lint-prompt: refuse a HOLD whose own work is already in an OPEN PR

## The defect this removes

`lint-prompt.mjs` decides ADMIT/REJECT by evaluating a prompt's `premise` against `origin/main`.
That is the right corpus for a prompt that has never run. It is the WRONG corpus for a prompt whose
PR is **open and unmerged**: the premise describes a condition the open PR fixes, so until that PR
merges the premise is still true on `main` and the spent prompt lints **ADMIT**.

[MEASURED] 2026-10-10T01:2xZ by Station 00, all 15 `docs/pr-prompts/*-HOLD.md` linted and classified
by **exit code** (not by grepping stdout - see the trap note below): **14 REJECT, 1 ADMIT**, and the
single ADMIT was `pr-sweep-section5-dedupe-and-fast-switch-HOLD.md`, whose PR **#2294 was OPEN**.
So the only armable prompt on the board was the one prompt that must never be armed. The same shape
was recorded by the two preceding Station 00 runs (breadcrumbs `...2026-10-09-2214-...`, which names
it *"a spent HOLD is re-armable"*, and `...2026-10-09-2315-...`), making this run the **third
consecutive** reproduction.

Why this is worth a gate rather than a note: arming it would send the watcher to rebuild work that
is already open as a PR, which is DOCTRINE 10.6 (*"a second-lane PR does not consume the prompt that
describes the same work"*) arriving from the opposite direction - there the PR came first and the
prompt stayed armed; here the prompt's OWN PR came first and the prompt stayed armable. The window
is bounded (once the PR merges, the premise dies and lint REJECTs it), but the window is exactly when
a station is most likely to look for something to arm: a board with one parked PR and nothing else.

## Build this

Add a check to `lint-prompt.mjs` that REJECTS with the code **`SPENT_HOLD_PR_OPEN`** when an open PR
already carries this prompt's work. Determine that from the prompt's own `scope`, which the schema
already requires:

1. Read the open PRs and their changed files once per invocation (`gh pr list --state open --json
   number,title,files`). `check-breadcrumb.mjs` already shells `gh pr list --state open --limit 100
   --json files`, so this is an existing call shape in this directory, not a new dependency.
2. A prompt is SPENT when an open PR's changed-file set contains **the prompt's own path** (every
   prompt's `scope` names its own retirement path under `superseded/`, per PROMPT-SCHEMA's
   self-retirement rule) **or** contains every non-prompt path in `scope`. Report the PR number in
   the rejection message.
3. Order it **after** the existing premise evaluation and **before** the ADMIT return, so an
   already-REJECT prompt keeps the more specific code it has today.

Add `scripts/pipeline/__tests__/lint-prompt-spent-hold.test.mjs` asserting at minimum:

- a HOLD whose own `superseded/` path appears in an open PR's file list REJECTS with
  `SPENT_HOLD_PR_OPEN` and names the PR number;
- a HOLD with a live premise and NO matching open PR still ADMITs (the positive control - this is
  the reading the whole gate depends on, and DOCTRINE 7 requires the check be seen to PASS before
  any FAIL of it is believed);
- the `gh` call failing or returning nothing produces a LOUD failure, **never** a silent ADMIT.
  DOCTRINE 7: *"a tool that cannot run must FAIL LOUD, never fail quiet"*, and 9.6: *"an empty result
  is not an empty world"* - zero open PRs must not be indistinguishable from `gh` being down.

## Do NOT

- Do NOT change any existing rejection code, its wording, or its exit code. `lint-prompt.mjs` exit 0
  = ADMIT and exit 1 = REJECT is relied on by `arm-prompt.ps1` and by stations.
- Do NOT make the new check gate on the prompt's filename, PR title, or branch name. All three have
  been measured to drift; `scope` is the schema-enforced field.
- Do NOT edit `scripts/pipeline/instrument-lane.json` - the allowlist is Marco's.
- Do NOT touch anything under `sot/`, `apps/`, `prisma/`, `.github/`, `scripts/pr-gates/` or
  `scripts/pr-watcher/`.
- Do NOT weaken, skip or quarantine any existing test to make the new one pass (DOCTRINE 8.2: a
  quick fix is only ever a legitimate unblock, never a mask).

## A trap in this very file's subject matter - read before you verify

**Do not classify a lint verdict by grepping stdout for `ADMIT`.** Station 00 did exactly that this
run and got 5 false ADMITs, because the REJECT message itself contains the sentence *"A bare ADMIT
would be indistinguishable from a prompt whose gate IS satisfied."* The same mistake is recorded in
the 2026-10-09 1913Z breadcrumb, so this is its second occurrence. **The exit code is the verdict.**
This is DOCTRINE 9.6's *"mint a fresh needle"* generalised: a corpus that DESCRIBES a positive answer
returns a false positive for that answer, and a rejection message describing ADMIT is such a corpus.
Your new test must assert on the **exit code and the code string**, never on the presence of the word.

## VERIFY before opening the PR

```
pnpm lint
node --test scripts/pipeline/__tests__/lint-prompt-spent-hold.test.mjs
node --test scripts/pipeline/__tests__/            # the whole suite, nothing else may break
git diff --name-only origin/main                   # exactly the three paths in scope
grep -n "SPENT_HOLD_PR_OPEN" scripts/pipeline/lint-prompt.mjs
```

Then prove the gate both ways against the live board, quoting both readings:

```
node scripts/pipeline/lint-prompt.mjs docs/pr-prompts/<a HOLD with an open PR>  ; echo "exit=$?"
node scripts/pipeline/lint-prompt.mjs docs/pr-prompts/<a HOLD with no open PR>  ; echo "exit=$?"
```

**Title the PR** `fix(pipeline): <summary>` - `module: pipeline`, enforced by `check-pr-title.mjs`.

## Lane expectation

`scripts/pipeline/lint-prompt.mjs` and `scripts/pipeline/__tests__/**` are both inside
`instrument-lane.json`'s allowlist, so the code half of this PR is IN lane. But `scope` also names
this prompt's own retirement path under `docs/pr-prompts/superseded/`, and the lane's `_readme` puts
**everything under `docs/`** on the never-list while `INSTRUMENT_LANE_V1` requires EVERY changed file
to be in lane - so expect `OUT_OF_LANE` and expect Marco to release it, exactly as #2294 did.
**Do not try to buy `IN_LANE` by dropping the retirement path from `scope`:** a prompt whose `scope`
does not name its own file is never retired by the PR that builds it and stays armable forever, which
is the defect this prompt exists to close. That lane interaction is already open with Marco as F77 of
the Station 00 breadcrumb dated 2026-10-09 1714Z.

## STANDING AUTHORITY

**You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
**"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** There is no human in this run.
**Finishing the work and then asking for permission is indistinguishable from failing.**

## Guardrails

- One attempt. Never exit silently - if you cannot do it, say `NO-OP: <reason>` and why.
- Read the job log before diagnosing any CI failure (DOCTRINE 3: never diagnose from the diff).
- Hard stop, report and exit: Azure / Entra / SharePoint, production auth or secrets, production
  data, any irreversible action.
- **Budget.** One script change, one test file, one retirement rename.
