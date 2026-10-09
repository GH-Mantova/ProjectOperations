---
premise: '! grep -q "PR_TITLE_MODULE_V1" scripts/pr-watcher/index.mjs'
premise_means: >-
  Every prompt has a validated module, either declared or derived from `scope` by deriveModule() in
  lint-prompt.mjs. check-pr-title.mjs fails any PR whose title scope is not a real module. But the
  module never reaches the build agent, so the agent invents its own title scope. MEASURED
  2026-10-02 at origin/main 57a4909e: index.mjs spawns `claude --print` and writes the raw prompt
  body to stdin (the `child.stdin.write(promptBody)` call). It adds nothing about the title, and
  imports nothing from lint-prompt.mjs. Worked instances from the 2026-09-24 handover: #2071, #2093
  and #2108 all opened as `feat(scopecards-...)`, failed the required title check, and had to be
  retitled by hand. 10 of 22 depth-1 HOLDs declare no `module:`. 4 of those are ambiguous or
  unresolvable and survive only through scripts/pipeline/module-baseline.json.
done_when: >-
  pnpm build && pnpm lint &&
  node --test "scripts/pr-watcher/__tests__/*.mjs" &&
  node --test "scripts/pipeline/__tests__/*.mjs" &&
  grep -q "PR_TITLE_MODULE_V1" scripts/pr-watcher/index.mjs &&
  grep -q "export function resolvePromptModule" scripts/pipeline/lint-prompt.mjs &&
  test -f scripts/pr-watcher/__tests__/pr-title-module.test.mjs &&
  grep -q "^module: rates" docs/pr-prompts/pr-524-rates-b-slice2-canonical-HOLD.md &&
  grep -q "^module: jobs" docs/pr-prompts/pr-nav-jobs-projects-merge-HOLD.md
scope:
  - scripts/pr-watcher/index.mjs
  - scripts/pr-watcher/__tests__/pr-title-module.test.mjs
  - scripts/pipeline/lint-prompt.mjs
  - scripts/pipeline/__tests__/lint-prompt-module.test.mjs
  - scripts/pipeline/module-baseline.json
  - docs/pr-prompts/PROMPT-SCHEMA.md
  - docs/pr-prompts/pr-524-rates-b-slice2-canonical-HOLD.md
  - docs/pr-prompts/pr-fv2-ai-digests-HOLD.md
  - docs/pr-prompts/pr-fv2-output-channels-HOLD.md
  - docs/pr-prompts/pr-nav-jobs-projects-merge-HOLD.md
  - docs/pr-prompts/pr-rates-s11c-drop-legacy-tables-HOLD.md
  - docs/pr-prompts/pr-retire-tenderclientnote-s2-HOLD.md
  - docs/pr-prompts/pr-siteid-notnull-backfill-HOLD.md
  - docs/pr-prompts/pr-tenant-mt4-s2-ownership-migration-HOLD.md
  - docs/pr-prompts/pr-tipid-s3-retire-the-name-guard-for-an-id-check-HOLD.md
  - docs/pr-prompts/pr-vendor-invoice-ocr-HOLD.md
size: 3
gate_allow: none
backfill: false
seed_only: false
rollback_strategy: >-
  Watcher prompt footer, one exported lint helper, one warning, ten front-matter lines. Reverting
  restores agent-invented titles; the module lines are harmless metadata either way.
escalates: true
module: pipeline
---

# The build agent is told the PR title scope; every staged prompt declares its module

STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.

## What Marco asked for (2026-10-02)

Fix the module tags. The real gap is not the tag itself but the hand-off: the module is already
known and validated, and it never reaches the agent that writes the title. This slice closes the
hand-off, backfills the ten untagged prompts, and adds a non-blocking warning so new prompts
declare it.

## 1. `scripts/pipeline/lint-prompt.mjs`

- Export `resolvePromptModule(fileText, repoRoot)`. It parses the front matter the same way the
  linter does and returns `{ module, source }` from the existing `checkModuleProvenance` logic
  (`declared`, `derived`, `incidental`, or `null` when ambiguous/unresolvable). Reuse the code; do
  not copy the derivation.
- Add a **WARNING** (not a REJECT) `MODULE_NOT_DECLARED` when the module resolves only by
  derivation: `module: <derived> resolved from scope - declare it so the PR title is explicit`.
  The prompt still lints ADMIT. Existing warnings and REJECTs are unchanged.

## 2. `scripts/pr-watcher/index.mjs`

Tag with `PR_TITLE_MODULE_V1`.

- Import `resolvePromptModule` from `../pipeline/lint-prompt.mjs`.
- For a **build** prompt only (not `rev-*`, not a fix-lane prompt), resolve the module before the
  `child.stdin.write(promptBody)` call. If it resolves, append exactly this footer to what is
  written to stdin. Do not modify the file on disk.

  ```

  ---
  PR TITLE (set by the watcher, PR_TITLE_MODULE_V1): title your PR `<type>(<module>): <summary>`
  with <module> = `<resolved>`. check-pr-title.mjs fails any other scope.
  ```

- If it does not resolve, append nothing and log
  `title-module: <name> has no resolvable module - agent will choose`.
- If the prompt is a fix-lane prompt, log nothing extra. It edits an existing PR whose title is set.
- Wrap the resolve in try/catch. A failure logs and appends nothing; it must never stop the build.

Extract the footer construction as a pure exported function `titleFooter(module)` so it is
testable.

## 3. Backfill the ten depth-1 HOLDs

Add one `module:` line to each front matter, directly after `escalates:` (or at the end of the
front matter if that key is absent). **Change nothing else in these files.** Several are human-gated
or destructive, and their gates, premises and bodies must be byte-identical apart from this line.

| prompt | module | why |
|---|---|---|
| `pr-524-rates-b-slice2-canonical` | `rates` | scope is ambiguous (estimates, admin); it drops the legacy rate tables |
| `pr-fv2-ai-digests` | `forms` | matches the derivation |
| `pr-fv2-output-channels` | `forms` | ambiguous (forms, pdf-rendering); it is Forms v2 |
| `pr-nav-jobs-projects-merge` | `jobs` | unresolvable (`apps/web/src/**`); the merged surface is "Jobs" |
| `pr-rates-s11c-drop-legacy-tables` | `rates` | derivation is the incidental `prisma` |
| `pr-retire-tenderclientnote-s2` | `admin-imports` | matches the derivation |
| `pr-siteid-notnull-backfill` | `sites` | derivation is the incidental `prisma` |
| `pr-tenant-mt4-s2-ownership-migration` | `tenants` | derivation is the incidental `prisma` |
| `pr-tipid-s3-retire-the-name-guard-for-an-id-check` | `map-locations` | ambiguous (map-locations, pipeline) |
| `pr-vendor-invoice-ocr` | `procurement` | matches the derivation |

Then **remove** the four entries now declared (`pr-524-rates-b-slice2-canonical`,
`pr-fv2-output-channels`, `pr-nav-jobs-projects-merge`, `pr-tipid-s3-retire-the-name-guard-for-an-id-check`)
from `scripts/pipeline/module-baseline.json`. The baseline may only shrink. Touch no other entry.

Lint all ten after the edit. Each must keep its **exact previous verdict code** (ADMIT stays ADMIT,
`HUMAN_GATE_PRESENT` stays `HUMAN_GATE_PRESENT`, and so on), now without a module warning. Paste the
before/after table into the PR body.

## 4. `docs/pr-prompts/PROMPT-SCHEMA.md`

In the `module` section, add: the watcher appends the resolved module to the build prompt as the
required PR title scope (`PR_TITLE_MODULE_V1`), and a prompt that only derives its module lints with
the `MODULE_NOT_DECLARED` warning. Declaring it is now the expected practice.

## Tests

- New `scripts/pr-watcher/__tests__/pr-title-module.test.mjs`:
  1. `titleFooter("tendering")` contains `` `tendering` `` and `PR_TITLE_MODULE_V1`.
  2. `resolvePromptModule` on a fixture with `module: crm` returns `crm` / `declared`.
  3. A fixture with no `module:` and `apps/api/src/modules/rates/**` in scope returns `rates` /
     `derived`.
  4. An ambiguous fixture returns `module: null`.
  5. **Negative control:** an unparseable file returns `module: null` without throwing.
- Extend `scripts/pipeline/__tests__/lint-prompt-module.test.mjs`: the derived case emits
  `MODULE_NOT_DECLARED` as a warning and still ADMITs; a declared case emits no such warning.

`escalates: true`: it edits the watcher, the linter and Marco-gated prompts. The PR opens labelled
`do-not-merge`, and Marco releases it.
