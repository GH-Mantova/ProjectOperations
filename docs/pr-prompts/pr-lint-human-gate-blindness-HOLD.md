---
premise: '! grep -q "HUMAN_GATE" scripts/pipeline/lint-prompt.mjs'
premise_means: The prompt linter cannot see a human arming gate written in a prompt body, so it returns ADMIT on prompts a person has explicitly marked do-not-arm.
scope:
  - scripts/pipeline/lint-prompt.mjs
  - scripts/pipeline/__tests__/lint-prompt.human-gate.test.mjs
  - docs/pipeline/ARMING.md
done_when: node --test scripts/pipeline/__tests__/lint-prompt.human-gate.test.mjs && grep -q "HUMAN_GATE" scripts/pipeline/lint-prompt.mjs
size: 4
gate_allow: none
seed_only: false
escalates: false
---

# The prompt linter reads the body without understanding markdown, and gets it wrong twice

## The defect, measured 2026-08-26 against `a57d22c5`

`lint-prompt.mjs` validates front matter and runs the premise. It never reads the body for a human
arming gate. So a prompt whose own text says, in capitals, that it must not be armed still returns
`ADMIT`, exit 0 — and `ADMIT` is exactly what an arming decision trusts.

Measured across the 61 `pr-*.md` at the queue root: **12 carry a gate the linter cannot see.**

```
pr-524-rates-b-slice2-canonical-HOLD.md          [DO NOT ARM, Arm ONLY, docs/approvals/]
pr-e2e-container-s2-swap-required-job-HOLD.md    [DO NOT ARM]
pr-gate-release-is-not-a-reject-HOLD.md          [DO NOT ARM]
pr-nav-jobs-projects-merge-HOLD.md               [DO NOT ARM, Arm ONLY]
pr-ops-m2b-tipping-tab-reminder-HOLD.md          [DO NOT ARM, Arm ONLY]
pr-rates-s11c-<elided>-tables-HOLD.md         [DO NOT ARM, docs/approvals/]
pr-retire-tenderclientnote-s2-HOLD.md            [DO NOT ARM, docs/approvals/]
pr-siteid-notnull-backfill-HOLD.md               [<!-- watcher: do-not-arm -->, docs/approvals/]
pr-tenant-mt4-s2-ownership-migration-HOLD.md     [DO NOT ARM, docs/approvals/]
pr-unified-api-key-vault-slice4c-retire-old-screens-HOLD.md  [DO NOT ARM]
pr-user-default-dashboard-ui-RETIRED-...md       [DO NOT ARM]
pr-vendor-invoice-ocr-HOLD.md                    [DO NOT ARM]
```

Control: 21 of the 61 match the generic word `arm`, so the detector is neither matching everything
nor nothing.

Three were linted directly. **All three returned `ADMIT`, exit 0:**

```
ADMIT  pr-rates-s11c-<elided>-tables-HOLD.md  (size 8)   <- drops legacy DB tables
ADMIT  pr-retire-tenderclientnote-s2-HOLD.md     (size 6)
ADMIT  pr-siteid-notnull-backfill-HOLD.md        (size 8)
```

DOCTRINE §9.5 already records this as "ADMIT is NECESSARY, NOT SUFFICIENT" and tells a human to read
the body by eye. **A rule that depends on remembering to look is not a guard.** The linter is the
only thing in the chain that reads the whole prompt; it should be the thing that refuses.

## The second defect, reproduced while writing this prompt

The TIER-1 destructive detector fires on **quoted filenames**. Authoring this very prompt tripped it:
the evidence table above cites a prompt whose *name* contains a destructive-sounding fragment, and
the linter refused the whole file:

```
REJECT  pr-lint-human-gate-blindness-HOLD.md  [DESTRUCTIVE_MUST_ESCALATE]
        Destructive signal detected ("drop-<elided> / drop_<elided>") but `escalates` is not `true`.
```

This prompt drops nothing. It names a file. Station 04 reported the same class on 2026-08-25
(02:10Z, F7) from a different direction, and it is why the filename above is elided rather than
written plainly — a workaround, in a prompt, for a linter bug, which is exactly the wrong shape.

Reproduced a **third, fourth and fifth** time while writing the paragraph you are reading: naming the destructive DDL
statement in a test-coverage bullet tripped the detector again, so it too had to be elided. The
prompt that specifies the fix cannot be written without triggering the bug it specifies. Five
reproductions, all from ordinary authoring, none of them destructive work — the last one from
quoting the linter's OWN error message back into a prompt. Every destructive-sounding
term in this file is elided for exactly one reason: the detector cannot read markdown.

**Both defects are the same root cause: the linter scans the body as flat text.** It cannot tell an
instruction from a quotation. One shared normalizer fixes both, which is why they are one slice and
not two.

## What to build

### 1. `lint-prompt.mjs` — a pure, exported `checkHumanGate(bodyText)`

Follow the shape of the existing `checkFixesPrTargetOpen`: pure, exported, unit-testable, returning
`{ ok: true }` or `{ ok: false, code, msg }`.

**Hard REJECT — code `HUMAN_GATE_PRESENT`** on any of these three, which are unambiguous
instructions and nothing else:

| Marker | Match |
|---|---|
| `<!-- watcher: do-not-arm -->` | `/<!--\s*watcher:\s*do-not-arm\s*-->/i` |
| a line containing `DO NOT ARM` | case-sensitive on the words, anywhere in the line |
| a line containing `Arm ONLY` | conditional arming — a person named the condition |

**WARN only — do not reject** on a `docs/approvals/` reference. A prompt can *mention* that folder
without being gated by it, and a false REJECT on a legitimate prompt is the failure mode that binned
real work before (DOCTRINE §7, lie #3). Print it; let the human weigh it.

**Ignore matches inside fenced code blocks AND inside inline code spans.** A prompt that *documents*
this feature — including the one that builds it, and this very file — quotes these strings as
examples. Strip ``` fences and `backtick` spans before scanning, or the linter rejects its own
documentation and refuses to arm the detector that fixes the blindness. Station 00 predicted this
exact own-goal on 2026-08-25 (12:08Z, F3); it is the reason the naive grep was never shipped.

Wire it in `lint()` **before** the premise runs: it is a pure string check with no subprocess, and a
gated prompt should never pay for a premise execution. Return through the existing `fail()` path so
the exit code and output format are unchanged.

The message must name **which** marker matched and **the line it is on**, and end with the one thing
that clears it: a human removing the marker.

### 1b. The same normalizer must gate the TIER-1 destructive check

Extract the strip-fences-and-code-spans step as one exported helper — `stripCodeContext(text)` —
and run **both** the human-gate scan and the existing destructive-signal scan over its output.

Do not weaken the destructive detector in any other way. A real destructive DDL statement in prose,
in scope, or
in front matter must still force `escalates: true`. The only thing that changes is that a term
inside `backticks` or a ``` fence is a quotation, not an instruction.

### 2. `scripts/pipeline/__tests__/lint-prompt.human-gate.test.mjs`

`node --test`, and it will actually run — `.github/workflows/ci.yml:174` runs
`node --test "scripts/pipeline/__tests__/*.mjs"` on the Ubuntu runner, and `checkHumanGate` is pure,
so nothing here is Windows-only.

Cover, at minimum:

- each of the three hard markers rejects, with the right `code`
- **a negative control**: an ordinary prompt body with no marker returns `ok: true` — a test that has
  never been seen to pass on the good case is not a test
- a body containing `DO NOT ARM` **inside a fenced code block** returns `ok: true`
- `docs/approvals/` alone does **not** reject
- the marker's line number appears in the message
- **TIER-1**: a body quoting a destructive-sounding FILENAME in backticks does NOT force escalates
- **TIER-1 control**: a body with a real, un-quoted destructive DDL statement in prose still DOES
  force `escalates: true`. Spell the statement out in the test file, not in a prompt body —
  see the note below.

### 3. `docs/pipeline/ARMING.md`

Add `HUMAN_GATE_PRESENT` to the documented codes: what triggers it, that `docs/approvals/` only
warns, and that the only thing that clears it is a person editing the prompt.

## Do NOT

- Do NOT bin, rename or move any prompt. This is a REJECT, never a stale-bin. The existing
  `dequeue` rename path is for `PREMISE_ALREADY_SATISFIED` only, and reusing it here would silently
  delete twelve real work items.
- Do NOT edit `docs/pipeline/DOCTRINE.md`. §9.5's "ADMIT is necessary, not sufficient" line does
  become out of date, but §9 is a hash-recorded CANONICAL-BLOCK and changing it means re-recording
  the hash across all six station docs in one PR. Out of scope; note it in the PR body.
- Do NOT edit any of the 12 gated prompts. They are gated on purpose.
- Do NOT add a flag or env var to bypass the new check. A guard with an escape hatch is not a guard.
- Do NOT touch the premise runner, the front-matter parser, or `ghFetchPrState`.

## VERIFY

```bash
node --test scripts/pipeline/__tests__/lint-prompt.human-gate.test.mjs
node scripts/pipeline/lint-prompt.mjs docs/pr-prompts/pr-siteid-notnull-backfill-HOLD.md ; echo "exit=$?"
node scripts/pipeline/lint-prompt.mjs docs/pr-prompts/pr-crm-wincount-s2-close-bypasses-HOLD.md ; echo "exit=$?"
node scripts/pipeline/test-lint-prompt.mjs
```

The first ungated prompt above must still ADMIT with exit 0 — that is the control. The gated one must
now REJECT with `HUMAN_GATE_PRESENT`. If the control stops admitting, the check is too broad and the
fix is wrong.

## Guardrails

- One attempt. If `HUMAN_GATE` already exists in `lint-prompt.mjs`, say `NO-OP: <reason>`.
- Both existing lint test entry points must still pass.
- Never exit silently. Never ask a question or stand by for approval - there is no human in this run.
- Read the job log before diagnosing any CI failure.

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** - the work is discarded either way.
