---
premise: '! grep -q "FILE_GATE_NOT_RELEASED" scripts/pipeline/lint-prompt.mjs'
premise_means: >-
  A HOLD whose requires_file_on_main path is ABSENT from origin/main lints as a bare ADMIT. The gate is a
  no-op in the only direction that matters, and twelve prompts depend on it — three of them on Marco
  approval markers.
scope:
  - scripts/pipeline/lint-prompt.mjs
  - scripts/pipeline/__tests__/**
done_when: >-
  pnpm lint && grep -q "FILE_GATE_NOT_RELEASED" scripts/pipeline/lint-prompt.mjs
size: 3
gate_allow: none
seed_only: false
escalates: false
backfill: false
cluster: pipeline-guard
cluster_order: 2
requires_on_main: scripts/pipeline/lint-prompt.mjs :: checkGateNotReleased
---

# PIPELINE GUARD 3 — an unmet file gate must REJECT, not admit silently

## The defect, measured with controls on 2026-08-27 at `478112c5`

Two runs of `lint-prompt.mjs` against the same one-line HOLD, changing only the gate path:

```
requires_file_on_main: docs/plans/crm-module-plan.md          (on main)
  → PROMOTE  GATE_RELEASED ... is now on origin/main — HOLD is ready to promote.

requires_file_on_main: docs/approvals/definitely-not-a-real-file.md   (absent)
  → ADMIT                                     ← no code, no warning, nothing
```

The probe itself works — control A proves it reached origin/main and read the tree. The absent branch
simply does not report. `checkFileGateDead` (`:481`) hits
`if (contents.absent) continue; // path missing on main = gate legitimately unmet` (`:499`) — the
comment is **right about the state and wrong about the consequence**: it identifies an unmet gate and
then falls through to `{ ok: true }`.

Nothing downstream catches it. `checkGateNotReleased` (`:795`) is the function that exists precisely to
stop a bare ADMIT from being "indistinguishable from a HOLD whose gate IS satisfied" — its own message
says so — but it reads `parseRequiresOnMainEntries(fm)` only. **It never looks at
`requires_file_on_main` at all.** It also skips the needle-less form outright:
`if (!needle) continue; // existence-only gate — not our check`.

Note this is **not** the missing-`gh` waiver recorded in DOCTRINE §9.5. This path shells out to git, not
`gh`, and control A shows it ran. §9.5 should be corrected separately; do not edit it in this slice
(`/sot/` and DOCTRINE are not in scope).

## Blast radius

**12 prompts** carry `requires_file_on_main`. Three gate on a Marco approval marker:

| prompt | marker | on main? | lints as |
|---|---|---|---|
| `pr-rates-s11c-drop-legacy-tables-HOLD.md` | `rates-s11c-...-approved-by-marco.md` | ABSENT | **ADMIT** |
| `pr-524-rates-b-slice2-canonical-HOLD.md` | `rates-b-slice2-...-approved-by-marco.md` | ABSENT | REJECT (other cause) |
| `pr-retire-tenderclientnote-s2-HOLD.md` | `retire-tenderclientnote-s2-...` | ABSENT | REJECT (other cause) |

The first of those is the slice that **permanently drops eight database tables**. It is still held in
practice by `escalates: true` and its own draft-PR hard stop — but the gate intended to be the stop is
inert, and the other two only reject by luck of an unrelated failure.

The needle-less `requires_on_main: <path>` form is currently used by **zero** prompts (measured), so it
is a latent hole rather than a live one. Close it anyway.

## Do

1. Extend `checkGateNotReleased` (`:795`) to cover **existence-only gates on HOLDs**, both forms:
   - every `requires_file_on_main` path, and
   - every `requires_on_main` entry with no `::` needle (drop the `if (!needle) continue` skip).

   When the path is ABSENT from origin/main, return
   `{ok:false, code:"FILE_GATE_NOT_RELEASED"}` with a message in the same register as the existing
   `GATE_NOT_RELEASED` text: name the path, say the HOLD is correctly waiting, and say that a bare ADMIT
   would be indistinguishable from a satisfied gate.
2. Leave `checkFileGateDead` alone apart from a comment correcting `:499` to point at the new check.
   FILE_GATE_DEAD and GATE_RELEASED both stay exactly as they are.
3. Keep the fail-safe: a probe that cannot reach origin/main still WARNs and admits. **A broken git must
   not bin the queue** — that rule is not being changed.

## Do NOT

- **Do NOT apply this to non-HOLD prompts.** An armed prompt is mid-flight; rejecting it on a gate is a
  different behaviour change and not this slice's.
- **Do NOT change FILE_GATE_DEAD**, GATE_RELEASED, or the promotion signal. A HOLD whose gate has landed
  must still read PROMOTE.
- Do NOT edit `/sot/`, `DOCTRINE.md`, or any prompt file. Correcting §9.5's attribution is a separate
  docs slice and mixing it here would break CP-24.
- Do NOT touch `scripts/pr-watcher/` — that is P0-a and P0-b.
- Do NOT "fix" the twelve affected prompts. Several are *supposed* to be parked; this slice makes that
  visible, and Marco decides what to do with what it surfaces.

## Tests

Beside `__tests__/lint-prompt.human-gate.test.mjs`, same style.

1. **The regression, exactly**: a HOLD with `requires_file_on_main` pointing at an absent path →
   `FILE_GATE_NOT_RELEASED`. Today this returns ADMIT; that is the whole bug.
2. Same HOLD, path present on main → still `GATE_RELEASED` / promote. **Negative control** — the fix
   must not turn a released gate into a rejection.
3. A **non-HOLD** with an absent gate path → unchanged behaviour.
4. Needle-less `requires_on_main: <path>`, absent → `FILE_GATE_NOT_RELEASED`; present → admits.
5. Probe failure (git unreachable) → WARN + admit, both forms. The fail-safe must survive.
6. A prompt with no gate key at all → admits, unchanged.

## STOP AND REPORT

- Adding the check makes a prompt reject that is genuinely ready to run. Name it and stop — that would
  mean the gate semantics are more subtle than this measurement shows.
- `checkGateNotReleased` cannot see `requires_file_on_main` without changing `parseRequiresOnMainEntries`
  in a way that alters `requires_on_main` handling. Report rather than refactoring both.

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** There is no human in this run.
> **Finishing the work and then asking for permission is indistinguishable from failing.**

Every scope limit above still applies; a scope limit is not a reason to stop before pushing. STOP AND
REPORT means **open the PR, put the problem in the body, leave it unmerged** — never exit without a PR.
Report measurements, not conclusions.
