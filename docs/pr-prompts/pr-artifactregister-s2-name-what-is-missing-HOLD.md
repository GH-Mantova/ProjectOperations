---
premise: 'git ls-files --error-unmatch docs/design/ARTIFACT-REGISTER.md >/dev/null 2>&1 && ! grep -q "Held outside the tree" docs/design/ARTIFACT-REGISTER.md'
premise_means: >-
  The register indexes published artifacts and says nothing about designs that were never
  published. MEASURED 2026-09-05: three approved mock-ups are cited by name in tracked files and
  exist in the repository not at all - and they are not in the artifact gallery either (33
  artifacts, owned and shared, enumerated 2026-09-05). They were found on Marco's machine, in
  `C:\Users\Marco\Downloads`: `erp-settings-home-mockup.pdf` and `erp-theme-builder-mockup.pdf`
  (both printed from Chromium 2026-09-01 12:44 local), and `theme-system-mockup.html`
  (2026-08-17). So they were never artifacts and never tracked - they are browser downloads, which
  is why no id was ever findable and why `git grep` returns the citation and no content. One disk
  failure or one Downloads cleanup ends them. A brief the tracked tree cannot open does not exist
  to an agent, and the register was built to close exactly that gap.
scope:
  - docs/design/ARTIFACT-REGISTER.md
done_when: >-
  grep -q "Held outside the tree" docs/design/ARTIFACT-REGISTER.md && grep -q "330c3e98" docs/design/ARTIFACT-REGISTER.md && grep -q "524ef7db" docs/design/ARTIFACT-REGISTER.md && grep -q "theme-system-mockup" docs/design/ARTIFACT-REGISTER.md && test "$(grep -c 'claude.ai/code/artifact/' docs/design/ARTIFACT-REGISTER.md)" -ge 34
size: 1
gate_allow: none
seed_only: false
escalates: false
---

# AR-S2: record the approved designs that live outside the tracked tree

**Grounded 2026-09-05 by the cloud/chat lane (station 06).** One tracked file is edited. Nothing
is created, nothing is deleted, no row is removed.

AR-S1 built `docs/design/ARTIFACT-REGISTER.md` so a brief could be found from the tracked tree. It
indexes what was published. This slice closes the other half: three **approved** mock-ups were
never published and were never committed, so the tree carries their filenames and none of their
content, and every reader rediscovers that the slow way.

## Why this is a register change and not a search

Both searches have already been run. They are recorded here as measurements so that nobody repeats
them:

- The artifact gallery was enumerated 2026-09-05 - **33 artifacts**, owned and shared. None of the
  three is among them.
- `Claude Design/mockups/` holds **65** HTML mock-ups. None of the three is among them.
- All three were then located on Marco's machine under `C:\Users\Marco\Downloads`. They are
  browser downloads, outside any repository and outside the gallery.

Nothing on this box can enumerate the gallery, and nothing in CI can see a Downloads folder. Write
it down or lose it again.

## Do

### 1. Append two rows to `## Current and load-bearing`

Add these at the end of that table, in this order, keeping the existing column shape:

    | [Theme Builder](https://claude.ai/code/artifact/330c3e98-e1ae-4120-899b-66960785a112) | `330c3e98` | The Company profile **Brand & theme** tab: named colour schemes, palette editing with live contrast grading, the four `BrandAssetKind` slots, density, and a live preview. Published 2026-09-05 from the spec, then checked against the recovered `erp-theme-builder-mockup.pdf`. Records the schema gap - radius, type scale and spacing are not on `BrandColorScheme`. |
    | [Settings Home](https://claude.ai/code/artifact/524ef7db-7234-4254-8c7f-9e5da3d953c1) | `524ef7db` | The `/settings` landing page: 22 cards, counts computed from the live item list, tab chips, and locked settings shown with the permission each needs. Published 2026-09-05 from the spec, then checked against the recovered `erp-settings-home-mockup.pdf`. Design of record for `pr-settings-home-s1-cards-tabs-counts`. |

### 2. Insert a new section immediately BEFORE `## Retired`

Write it exactly as follows:

    ## Held outside the tree - approved designs that were never published

    These mock-ups were approved and are cited by name in tracked files, but they were never
    published as artifacts and never committed. They exist only as files in Marco's Downloads
    folder, so `git grep` finds the citation and never the content, and the gallery does not list
    them (33 artifacts, owned and shared, enumerated 2026-09-05). Do not go looking for an artifact
    id - there has never been one. Read the published rebuild, or the surviving spec named below.

    | Named as | Cited by | What it actually is | Status |
    |---|---|---|---|
    | `erp-settings-home-mockup.pdf` | `docs/pr-prompts/pr-settings-home-s1-cards-tabs-counts-HOLD.md:31` | A 4-page PDF printed from Chromium 2026-09-01, title "Settings Home - mock-up (§2.2 / §2.3)". Its spec survives in `docs/plans/settings-home-plan.md` (D43-D47) and in the citing prompt, which transcribes the approved description for 19 of the 20 pages. | **Published** as `524ef7db`. |
    | `erp-theme-builder-mockup.pdf` | the branding slices of `docs/plans/theme-system-plan.md` | A 3-page PDF printed from Chromium 2026-09-01, title "Brand & theme - settings mock-up". Its spec survives in D38/D39 (`ca8d9c08`) and in `BrandColorScheme` / `BrandAssetKind` in `apps/api/prisma/schema.prisma`. | **Published** as `330c3e98`. |
    | `theme-system-mockup.html` | referenced in conversation; no tracked citation found | A single-file HTML mock-up dated 2026-08-17, the predecessor of the Brand & theme design. | **Open** - not yet published; register it here if it is. |

    **A rebuild is not a scan of the original.** Both published pages were built from the written
    spec and then checked against the recovered PDF; where one disagrees with a stale number or tab
    list in an older prompt, the page's own build-notes panel says which is stale and why. Treat the
    published page as the design of record from 2026-09-05 forward, and the filename as history.

    **The rule this section exists to enforce:** a design that lives only in a browser download is
    one folder cleanup away from gone, and is invisible to every agent that searches the tree. When
    a design is approved, publish it and add its artifact URL to this register in the same change. A
    filename in a prompt is a citation to something the tracked tree cannot open.

### 3. Leave the header's historical count alone

The header paragraph reads "29 of 32 published artifacts had no pointer from any file in the
repository". Do not touch it. It is a historical measurement of the state AR-S1 fixed, and
renumbering it to 33 or 35 destroys the finding.

## Do NOT

- Do NOT remove or reorder any existing row. "Never delete a row" is the register's own rule.
- Do NOT move the two published rebuilds into Retired or into the folded table. They are current.
- Do NOT paste any artifact's or any PDF's content into the register. It is an index of pointers.
- Do NOT add a row for a Downloads path as though it were a location the repo can read.
- Do NOT go looking for the three named files, and do NOT write a script to enumerate artifacts.
  Nothing on this box can read the gallery; all three searches are recorded above.
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
