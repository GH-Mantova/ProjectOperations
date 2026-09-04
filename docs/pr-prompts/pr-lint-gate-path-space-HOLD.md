---
premise: '! grep -rq "gate path containing a space" scripts/pipeline/__tests__/'
premise_means: >-
  lint-prompt.mjs still resolves gate paths through a Windows shell, so any
  requires_file_on_main / requires_on_main path containing a SPACE is re-split at
  the space and reported ABSENT even when the file is on origin/main. No
  regression test pins the behaviour. The premise dies the moment that test lands.
scope:
  - scripts/pipeline/lint-prompt.mjs
  - scripts/pipeline/__tests__/lint-prompt.file-gate-not-released.test.mjs
done_when: >-
  node scripts/pipeline/lint-prompt.mjs docs/pr-prompts/pr-claudedesign-s2-spec-regeneration-plan-HOLD.md
  reports GATE_RELEASED rather than FILE_GATE_NOT_RELEASED, and the new regression test passes.
size: 2
gate_allow: none
seed_only: false
escalates: false
backfill: false
---

# Fix: a gate path containing a space is silently reported ABSENT

## STANDING AUTHORITY

STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.

Ordinary code fix inside `scripts/pipeline/`. No migration, no seed, no production data, no
Azure/Entra/SharePoint. Do not merge it yourself: this touches `scripts/`, which is outside
`tests|docs`, so it is Marco's to merge (DOCTRINE 10.1 step 2).

## The defect

`readFromOriginMain()` in `scripts/pipeline/lint-prompt.mjs` runs:

```js
execFileSync(gitBin, ["show", "origin/main:" + path], {
  ...
  shell: process.platform === "win32",
});
```

With `shell: true` on Windows, Node does not escape argv - it concatenates it (Node emits
`DEP0190` for exactly this). A path containing a space is therefore split into two shell
words, and git is asked for a path that does not exist.

Crucially, git's stderr then reads `fatal: path 'Claude' does not exist in 'origin/main'`,
which MATCHES the file-absent regex at the `catch` site. So the function returns
`{ absent: true }` - the *file-is-not-on-main* answer - instead of `null`, the
*git-is-broken, fail-safe* answer. **Nothing warns.** The caller reports
`FILE_GATE_NOT_RELEASED`, which on a `-HOLD` is the normal, healthy-looking verdict.

### Measured 2026-09-04T10:2xZ at origin/main aac5e187

Same probe, one knob varied, with both controls:

| path | `shell:true` (as lint runs it) | `shell:false` |
|---|---|---|
| `Claude Design/docs/01-commercial.md` (real gate, has space) | **ABSENT** - `fatal: path 'Claude' does not exist` | **PRESENT, 23637 bytes** |
| `CLAUDE.md` (positive control, no space) | PRESENT, 1930 bytes | PRESENT, 1930 bytes |
| `docs/zzz-no-such-file-zzz.md` (negative control) | ABSENT | ABSENT |

The positive control proves git and the probe are healthy; only the spaced path diverges.

### Blast radius

- **Today: one prompt.** `pr-claudedesign-s2-spec-regeneration-plan-HOLD.md` gates on
  `Claude Design/docs/01-commercial.md`. That file landed on main at **2026-09-04T07:39:35Z in
  #1573** (`CD-S1 - un-ignore the written half of Claude Design/`). Its gate has been satisfied
  since then and the prompt has been parked on a false negative ever since. Its own premise is
  still ALIVE (`docs/plans/claude-design-spec-regeneration-plan.md` is absent from main), so this
  is live work that is silently unreachable - not spent work.
- **Latent and general.** `Claude Design/` is the repo's one tracked directory with a space in
  its name, and #1573 only just un-ignored it. Every future gate pointing into it fails the same
  silent way.
- **It fails in BOTH directions.** On a `-HOLD` it fails CLOSED (work parked forever). On a
  non-HOLD the same false ABSENT suppresses `FILE_GATE_DEAD`, so a genuinely dead gate is never
  reported - that direction fails OPEN.

## The work

1. In `readFromOriginMain()` (`scripts/pipeline/lint-prompt.mjs`), **remove the `shell:` option**
   so git is spawned directly and argv is passed without re-splitting. This is the code path CI
   already exercises on every PR (`process.platform === "win32"` is false on the Linux runner), so
   the un-shelled form is the tested one; `git` is a real `.exe` and resolves without a shell.
   Do NOT "fix" this by quoting the argument - that keeps the concatenation surface for the next
   caller.
2. Leave `ghFetchPrState()` alone. It also passes `shell: process.platform === "win32"`, but its
   only interpolated argument is validated as a bare positive integer and it is commented as
   deliberate (`gh` needs shell resolution). Changing it is out of scope.
3. Add a regression test to
   `scripts/pipeline/__tests__/lint-prompt.file-gate-not-released.test.mjs` asserting that a
   **gate path containing a space** which IS present on origin/main does NOT report
   `FILE_GATE_NOT_RELEASED`. Use that exact phrase in the test name - the premise above greps
   for it, so the prompt dies when the fix lands.

## Verify before you exit

```
node scripts/pipeline/lint-prompt.mjs docs/pr-prompts/pr-claudedesign-s2-spec-regeneration-plan-HOLD.md
```

Before the fix this exits 1 with `FILE_GATE_NOT_RELEASED`. After the fix it must report the gate
as released/promotable. Quote both readings in the PR body.

`pnpm build` + `pnpm lint` must pass.

## Do not

- Do not rename `Claude Design/` or any file inside it. #1573 deliberately un-ignored that
  directory; renaming it to dodge the space would leave the defect live for every future path.
- Do not arm or promote `pr-claudedesign-s2-spec-regeneration-plan-HOLD.md` as part of this PR.
  Releasing its gate is Station 00's call on Marco's authority.
