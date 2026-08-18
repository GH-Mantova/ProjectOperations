---
premise: node -e "const l=require('fs').readFileSync('pnpm-lock.yaml','utf8');process.exit(/js-yaml@4\.3\.0|nanoid@3\.3\.17|extract-zip@2\.0\.1|deepmerge-ts@7\.1\.5/.test(l)?0:1)"
premise_means: The lockfile still pins at least one of the four packages carrying an open HIGH Dependabot advisory as of 2026-08-18 - js-yaml 4.3.0, nanoid 3.3.17, extract-zip 2.0.1, deepmerge-ts 7.1.5. All four are transitive; none is a direct dependency.
scope:
  - package.json
  - pnpm-lock.yaml
done_when: pnpm install --frozen-lockfile && pnpm build && pnpm lint
size: 2
gate_allow: dependencies
seed_only: false
escalates: false
---

# Clear the four HIGH Dependabot advisories - transitive lockfile bumps

The weekly security audit on 2026-08-18 found the settings baseline CLEAN (12/12) but **four open
HIGH advisories**, all opened in the preceding 7 days, all transitive in `pnpm-lock.yaml`:

| package | version | advisory | pulled in by |
|---|---|---|---|
| `deepmerge-ts` | 7.1.5 | GHSA-ggr8-5vv4-36mx | `@prisma/config` |
| `nanoid` | 3.3.17 | GHSA-2v37-7h3g-55p8 | `postcss` |
| `extract-zip` | 2.0.1 | GHSA-jmr9-qjv8-65gv | `@puppeteer/browsers` |
| `js-yaml` | 3.15.0 | GHSA-5p4m-2wfm-xmqj | `@istanbuljs/load-nyc-config` |
| `js-yaml` | 4.3.0 | GHSA-5p4m-2wfm-xmqj | `@nestjs/swagger`, `cosmiconfig` |

Dependency paths above were resolved with `pnpm why <pkg> --recursive` on 2026-08-18 and are
`[MEASURED]`, not inferred from the alert text.

## Prioritise by actual exposure - and say so in the PR body

Only ONE of these sits in the API's **runtime** tree: `js-yaml 4.3.0` via `@nestjs/swagger`. The
rest are build- or test-time only (`@prisma/config` is CLI, `postcss` is the CSS build,
`@puppeteer/browsers` and `@istanbuljs/load-nyc-config` are test tooling). That does not mean the
others can be ignored, but it does mean the swagger path is the one that matters if any bump turns
out to be difficult.

**First, verify each advisory actually applies to the pinned version.** Read each GHSA and confirm
the affected range covers the version in the lockfile. An advisory that does not apply is not a
finding, and bumping for it is churn. Report any that do not apply rather than bumping them.

## What to build

1. Add a `pnpm.overrides` block in the root `package.json` pinning each **still-affected** package
   to the lowest patched version the advisory names. Use overrides rather than chasing parent
   upgrades: the parents are correct, only the transitive pin is stale.
2. Regenerate `pnpm-lock.yaml`.
3. Add a short comment above the overrides block naming each GHSA and the date, so a future reader
   knows why the pin exists and when it can be dropped.

## What NOT to do

- Do NOT upgrade `@nestjs/swagger`, `@prisma/config`, `postcss` or `@puppeteer/browsers`
  themselves. That is a much larger change and is not what the advisories require.
- Do NOT add a runtime dependency. `gate_allow: dependencies` is declared for the override block
  and the lockfile churn only.
- Do NOT touch application code.

## Verification

    pnpm install --frozen-lockfile
    pnpm build
    pnpm lint
    pnpm --filter api test
    pnpm --filter web test

Then re-run `pnpm why <pkg> --recursive` for each package and paste the resolved version, proving
the override took effect. **A green build is not proof the override applied** - a mistyped package
name in an overrides block is silently ignored by pnpm.

State in the PR body which advisories you cleared, which you found did not apply, and the
before/after version for each.

You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.
