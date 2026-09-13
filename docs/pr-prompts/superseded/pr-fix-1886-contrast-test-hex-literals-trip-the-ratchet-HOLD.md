---
premise: "git fetch -q origin feat/theme-s6-preview-contrast-override && git show origin/feat/theme-s6-preview-contrast-override:apps/web/src/lib/__tests__/contrast.test.ts | grep -qi '#595959'"
premise_means: >-
  PR #1886's contrast.test.ts carries five hex literals (595959, 767676, EEEEEE and two more) in
  test names and a doc comment, so the hex ratchet ("no file may gain a hard-coded colour
  literal", scripts/pipeline/check-hex-ratchet.mjs - comments are NOT excluded) fails the
  Pipeline job on every head (run 34749741194). The prompt's TRAP 4 told the builder to assemble
  every hex fixture as HASH + "RRGGBB"; the source files comply (0 literals in contrast.ts,
  brand-scheme.ts, ThemeBuilderPreview.tsx and their other tests), this one test file does not.
  The tendering-e2e red on the same head was a webkit login timeout, re-run separately.
fixes_pr: 1886
scope:
  - apps/web/src/lib/__tests__/contrast.test.ts
done_when: >-
  ! grep -qiE '#[0-9a-f]{6}' apps/web/src/lib/__tests__/contrast.test.ts && node
  scripts/pipeline/check-hex-ratchet.mjs && pnpm --filter @project-ops/web test -- contrast
size: 1
gate_allow: none
seed_only: false
escalates: false
backfill: false
module: branding
---

# Repair PR 1886 - five hex literals in contrast.test.ts trip the hex ratchet

**Do this ON PR #1886's existing branch `feat/theme-s6-preview-contrast-override`. Do NOT open a
new PR.** The defect is inside that PR's own diff. main is green.

## FIRST: re-verify against the CURRENT head

Read the `Pipeline - watcher + linter tests` job log of the **latest** CI run on the branch and
confirm the red step is still `hex ratchet - no file may gain a hard-coded colour`, and run
`node scripts/pipeline/check-hex-ratchet.mjs` locally on the branch to see which file it names.
If the log shows something else, fix what it shows and say so plainly.

## What to change - `apps/web/src/lib/__tests__/contrast.test.ts` only

The ratchet greps for `#` followed by six hex digits anywhere in the file, comments and test
names included. Remove the literal SHAPE, not the values:

- In `it(...)` names, write the colour without the hash: `"grey 595959 on white resolves to
  approximately 7.0:1 (AAA boundary)"`.
- In the doc comment, the same: `595959 on white: ...`, `767676 on white: ...`, `EEEEEE on white`.
- Anywhere a fixture value is built, use the file's existing `HASH + "RRGGBB"` pattern (or
  `const HASH = "#"` if the file lacks it) exactly as the other S6 test files do.

The ratchet baseline (`docs/qa/hex-baseline.json`) is NOT to be regenerated: this file is new
and must simply contain zero literals.

## Verify, then push

1. `grep -ciE '#[0-9a-f]{6}' apps/web/src/lib/__tests__/contrast.test.ts` -> 0.
2. `node scripts/pipeline/check-hex-ratchet.mjs` -> exit 0.
3. `pnpm --filter @project-ops/web test -- contrast` -> green.
4. Commit on the branch with a message that describes the change and does NOT put the words
   fix/fixes/close/closes/resolve/resolves immediately before `#1886`.
5. Push. Do not open a PR - #1886 is the PR.

## STANDING AUTHORITY

**You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
In the fix lane "OPEN THE PR" is already satisfied: **#1886 is the PR** - push to its branch and
do not open another. There is no human in this run. **Finishing the work and then asking for
permission is indistinguishable from failing** - the work is discarded either way.

## Guardrails

- One attempt. If the premise is already false on the branch, say `NO-OP: already repaired` and exit.
- Touch only the file in `scope`.
- Never add or remove a label; never merge.
