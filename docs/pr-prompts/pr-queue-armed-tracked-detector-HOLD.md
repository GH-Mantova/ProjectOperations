---
premise: '! test -f scripts/pipeline/check-armed-tracked.mjs'
premise_means: Nothing detects a docs/pr-prompts/*-ready.md that exists in a working tree but is untracked because .gitignore:75 swallowed it. Such a prompt is invisible to every station and one `git clean` from deletion. Three separate sets have been rescued by hand; the mechanism is untouched.
scope:
  - scripts/pipeline/check-armed-tracked.mjs
  - scripts/pipeline/__tests__/check-armed-tracked.test.mjs
  - .github/workflows/ci.yml
done_when: pnpm lint && node --test "scripts/pipeline/__tests__/check-armed-tracked.test.mjs" && grep -q "check-armed-tracked" .github/workflows/ci.yml
size: 3
gate_allow: none
seed_only: false
escalates: false
requires_on_main: .github/workflows/ci.yml :: check-sot-refs
---

# Detect prompts that `.gitignore` swallowed

## The defect

`.gitignore:75` is `docs/pr-prompts/*-ready.md`, added by `d5bd4f58` (#805) with the rationale
*"committing them causes phantom dirty trees on branch switches."* That rationale is real and this
PR does **not** touch it.

But `.gitignore` has no effect on already-tracked paths, so two states coexist:

- **Arming by rename** (`git mv pr-x-HOLD.md pr-x-ready.md`) — file stays tracked, survives.
- **Arming by creation** (author a new `pr-x-ready.md`) — silently swallowed. Invisible to
  `04-scanner`, to the code-writer agents, to `05-sot-keeper`. One `git clean` from gone.

`origin/main` tracks 8 top-level `-ready.md` files while `git check-ignore -v` on any of them
returns exit 0 — a tracked file git also reports as ignored. That is the tell.

**Occurrences so far:** #1261, the four prompts of the `rates-column-hygiene` cluster, and
Supervisor's own `rev-1257` (LL-40). Three rescues, mechanism untouched.

**One of those sets was destroyed while this was being written.** On 2026-08-20 the four
`rates-column-hygiene` prompts were observed present in the dev tree's `docs/pr-prompts/` root, and
absent from it minutes later — not in `processed/`, `failed/`, `no-pr-opened/`, `blocked/` or
`paused/`, with no branch and no PR anywhere in the repo. They survived only because they had
already been committed to a branch. That is the failure this checker exists to make loud.

## ⚠️ `git status` cannot implement this

`git status --porcelain | grep '^??'` returns **nothing** for these files. Gitignored paths are
never reported as `??`. A previous scan nearly retracted a true finding on exactly that basis.

Only these two see them:

```
git check-ignore -v <path>          # exit 0 => ignored, prints the rule that did it
git ls-files --error-unmatch <path> # exit 0 => tracked; non-zero => NOT tracked
```

Use them. Do not reach for `git status`.

## What to build

**`scripts/pipeline/check-armed-tracked.mjs`** — for every `docs/pr-prompts/*-ready.md` present in
the working tree:

1. `git ls-files --error-unmatch <path>` → if exit 0, the file is tracked. **Pass.**
2. If untracked, look for a `-HOLD.md` counterpart on `origin/main` under the same base name
   (`pr-foo-ready.md` → `pr-foo-HOLD.md`). If one exists, this is a legitimate arming-by-rename
   mid-flight. **Pass.**
3. Untracked **and** no `-HOLD.md` twin on `origin/main` → **FAIL**, naming the file and saying
   plainly that it is invisible to every station and will not survive a `git clean`. Point at the
   fix: commit it as `-HOLD.md` and arm by `git mv`.

Exit non-zero on any failure so CI stops.

## Tests (required)

`scripts/pipeline/__tests__/check-armed-tracked.test.mjs`, following the style of the existing
`check-*` tests in that folder — no new framework, Node built-ins only.

1. **Positive control (the one that matters)** — a fixture `pr-fixture-ready.md` that is untracked
   and has **no** `-HOLD` twin must **FAIL** the checker. A checker that cannot fail is the thing
   this PR is replacing.
2. **Arming-by-rename passes** — untracked `pr-foo-ready.md` **with** `pr-foo-HOLD.md` on
   `origin/main` passes.
3. **Tracked `-ready.md` passes** — the 8 that already exist on main must not trip it.
4. **Empty case passes** — no `-ready.md` files at all is a pass, not a crash.

## Wiring

Add it to the **same CI job** as the sot-reference checkers — the one
`scripts/pipeline/check-sot-refs.mjs` joins (that is what this prompt's `requires_on_main` gates
on). Do **not** add a standalone workflow or a script nobody runs; four existing checkers
(`check-backlog`, `check-escalations`, `check-lessons`, `check-sot-bytes`) sat with no caller for
exactly that reason.

## Do NOT

- **Do NOT change `.gitignore`.** The phantom-dirt rationale behind `d5bd4f58` is real. This PR adds
  a detector, not an exemption.
- Do NOT move, rename, create or delete any prompt file. Read-only over `docs/pr-prompts/`.
- Do NOT use `git status` to find these files — see above.
- Do NOT add a dependency.

## Guardrails

- One attempt. If `scripts/pipeline/check-armed-tracked.mjs` already exists, say `NO-OP: <reason>`.
- `pnpm lint` and the new test must both pass.
- Three files. If it grows past that, stop and say so rather than widening scope.
- The checker runs in CI, where the working tree is a fresh checkout and will normally have zero
  untracked `-ready.md` files. That is expected: its value is on developer and watcher machines and
  as a standing statement of the rule. Do not "fix" the quiet CI pass by weakening it into
  something that greps main instead.
