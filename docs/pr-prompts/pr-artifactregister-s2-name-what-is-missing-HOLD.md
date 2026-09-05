---
premise: 'git ls-files --error-unmatch docs/design/ARTIFACT-REGISTER.md >/dev/null 2>&1 && ! grep -q "Known missing" docs/design/ARTIFACT-REGISTER.md'
premise_means: >-
  The register lists what exists and says nothing about what does not. MEASURED 2026-09-05:
  three design briefs are cited BY NAME in tracked files and are held nowhere this project can
  reach - not in the repository, and not in the artifact gallery (33 artifacts, owned and shared,
  enumerated 2026-09-05). Two of the three are cited as PDF FILENAMES, not artifact ids, which is
  why no id was ever findable for them: pr-settings-home-s1-cards-tabs-counts-HOLD.md:31 cites
  `erp-settings-home-mockup.pdf`, and the branding work cites `erp-theme-builder-mockup.pdf`. A
  reader who greps for either finds the citation and no content, concludes the brief is lost, and
  spends the search again. The register was built to stop exactly that, and a register that
  records only what it can see cannot.
scope:
  - docs/design/ARTIFACT-REGISTER.md
done_when: >-
  grep -q "Known missing" docs/design/ARTIFACT-REGISTER.md && grep -q "330c3e98" docs/design/ARTIFACT-REGISTER.md && grep -q "524ef7db" docs/design/ARTIFACT-REGISTER.md && grep -q "erp-theme-system-mockup" docs/design/ARTIFACT-REGISTER.md && test "$(grep -c 'claude.ai/code/artifact/' docs/design/ARTIFACT-REGISTER.md)" -ge 34
size: 1
gate_allow: none
seed_only: false
escalates: false
---

# AR-S2: record the briefs that are named in the tree and held nowhere

**Grounded 2026-09-05 by the cloud/chat lane (station 06).** One tracked file is edited. Nothing
is created, nothing is deleted, no row is removed.

AR-S1 built `docs/design/ARTIFACT-REGISTER.md` so a brief could be found from the tracked tree.
It indexes what exists. This slice closes the other half: three briefs are **cited by name in
tracked files and held nowhere**, and the register currently says nothing about them, so each
reader rediscovers that fact the slow way.

## Why this is a register change and not a search

The two searches have already been run and both are recorded here as measurements, not as work to
repeat:

- The artifact gallery was enumerated on 2026-09-05 - **33 artifacts**, owned and shared. None is
  a settings mock-up, a theme builder, or a theme system.
- `Claude Design/mockups/` holds **65** HTML mock-ups. None of the three is among them.

Nothing on this box can enumerate the gallery, so a future agent cannot re-derive this. Write it
down or lose it again.

## Do

### 1. Append two rows to `## Current and load-bearing`

Add these at the end of that table, in this order, keeping the existing column shape:

    | [Theme Builder](https://claude.ai/code/artifact/330c3e98-e1ae-4120-899b-66960785a112) | `330c3e98` | The branding and theme editor: colour schemes, palette editing with live WCAG contrast, the four `BrandAssetKind` slots, and a live preview pane. Rebuilt 2026-09-05 in place of `erp-theme-builder-mockup.pdf`. Records the schema gap - radius, type scale and spacing are not on `BrandColorScheme`. |
    | [Settings Home](https://claude.ai/code/artifact/524ef7db-7234-4254-8c7f-9e5da3d953c1) | `524ef7db` | The `/settings` landing page: 22 cards, counts computed from the live item list, tab chips, and locked settings shown with the permission each needs. Rebuilt 2026-09-05 in place of `erp-settings-home-mockup.pdf`. Design of record for `pr-settings-home-s1-cards-tabs-counts`. |

### 2. Insert a new section immediately BEFORE `## Retired`

Write it exactly as follows:

    ## Known missing - named in the tracked tree, held nowhere

    These briefs are cited by name in tracked files and exist in no place this project can reach:
    not in the repository, and not in the artifact gallery (33 artifacts, owned and shared,
    enumerated 2026-09-05). Two were cited as **PDF filenames** rather than artifact ids, which is
    why no id was ever findable for them. Do not search again - read the rebuild, or the surviving
    spec named below.

    | Named as | Cited by | Where the content actually survives | Status |
    |---|---|---|---|
    | `erp-settings-home-mockup.pdf` | `docs/pr-prompts/pr-settings-home-s1-cards-tabs-counts-HOLD.md:31` | `docs/plans/settings-home-plan.md` (decisions D43-D47, full item inventory) and the citing prompt itself, which transcribes the approved description for 19 of the 20 pages | **Rebuilt** as `524ef7db`. |
    | `erp-theme-builder-mockup.pdf` | the branding slices of `docs/plans/theme-system-plan.md` | D38 and D39 in `ca8d9c08`, plus `BrandColorScheme` and `BrandAssetKind` in `apps/api/prisma/schema.prisma` | **Rebuilt** as `330c3e98`. |
    | `erp-theme-system-mockup` | referenced in conversation only; no tracked citation found | Not located. | **Open** - if it is found, register it here rather than folding it. |

    **A rebuild is not the original.** Where a rebuild disagrees with a number or a tab list in an
    older prompt, the rebuild's own build-notes panel says which is stale and why. Treat the
    rebuild as the design of record from 2026-09-05 forward, and the citation as history.

    **The rule this section exists to enforce:** a brief cited as a *filename* is not findable. When
    a design is approved, add its artifact URL to this register in the same change. A filename in a
    prompt is a citation to something the tracked tree cannot open.

### 3. Update the count sentence in the header

The header paragraph currently reads "29 of 32 published artifacts had no pointer from any file in
the repository". Leave that sentence alone - it is a historical measurement of the state AR-S1
fixed, and rewriting it destroys the finding. Do not renumber it to 33 or 35.

## Do NOT

- Do NOT remove or reorder any existing row. "Never delete a row" is the register's own rule.
- Do NOT move the two rebuilt artifacts into Retired or into the folded table. They are current.
- Do NOT paste any artifact's content into the register. It is an index of pointers.
- Do NOT go looking for the three named files, and do NOT write a script to enumerate artifacts.
  Nothing on this box can read the gallery; both searches are already recorded above.
- Do NOT reproduce client names or personal names.
- Do NOT touch `sot/` - CP-24 hard-fails a PR that mixes `sot/` with anything else.
- Do NOT edit anything under `docs/pr-prompts/`, including the prompt that cites the settings PDF.
- Do NOT run `git checkout .`, `checkout -- <dir>`, `reset --hard`, `stash pop` or `git clean`.

## Verify

- `grep -c 'claude.ai/code/artifact/' docs/design/ARTIFACT-REGISTER.md` returns **34 or more**
  (it was 32 before AR-S2; the two new rows take it to 34).
- `git grep -l 330c3e98` and `git grep -l 524ef7db` each return this file and nothing else.
- `grep -c '^| \[' docs/design/ARTIFACT-REGISTER.md` has grown by exactly 2 against `origin/main`.
- `git diff --cached --name-only` lists **exactly one** path.
- The `## Retired` and `## Not yet classified` sections are byte-identical to `origin/main`.

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** - the work is discarded either way.

Every scope limit stated above still applies. A scope limit is **not** a reason to stop before
pushing.
