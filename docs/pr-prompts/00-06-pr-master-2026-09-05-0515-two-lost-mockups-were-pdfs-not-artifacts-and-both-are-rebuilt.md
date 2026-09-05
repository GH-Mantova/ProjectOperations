# Station 06 — 2026-09-05 05:15Z — the two lost mock-ups were PDFs, not artifacts, and both are rebuilt

## GROUND

`origin/main` at the start of this run: `cb3db13d` (GitHub API, 2026-09-05 05:16Z).
Interactive run — Marco present throughout. Station 06 designs and STAGES; it does not arm and
does not merge. Marco approved this staging explicitly ("do it", 05:0xZ) after being shown what
would be staged.

Status sweep run at 05:17:52Z before any mutation, per Phase 6 step 0.

Trigger: Marco could not find two design mock-ups — first the ERP theme builder, then "the one
that was turning the settings to something like Windows control panel". Both had been described
in an earlier session as lost artifacts.

## WHAT I MEASURED

**The artifact gallery.** Enumerated 2026-09-05, owned and shared: **33 artifacts**. No settings
mock-up, no theme builder, no theme system. Nothing on this box can enumerate the gallery, so this
measurement cannot be re-derived locally — it is written down in the register for that reason.

**The repository.** `Claude Design/mockups/` holds **65** HTML mock-ups; none of the three is
among them. A repo-wide sweep for `erp-*mockup*` returns exactly three strings, and two of them
end in `.pdf`:

| string | cited at |
|---|---|
| `erp-settings-home-mockup.pdf` | `docs/pr-prompts/pr-settings-home-s1-cards-tabs-counts-HOLD.md:31` |
| `erp-theme-builder-mockup.pdf` | the branding slices of `docs/plans/theme-system-plan.md` |
| `erp-mockup` | unrelated prefix |

That is the finding underneath the search: **they were never artifacts.** They were cited as PDF
filenames, so no artifact id was ever findable, and no amount of gallery searching would have
produced one.

**The settings nav model**, read from `apps/web/src/components/settings-nav-items.ts` (238 lines):
20 pages and **22 tabs** — Company 7, AI settings 2, Reference data & Lists 4, Field definitions 3,
Admin settings 6; the other 15 pages declare `tabs: []`. With the two pages the staged slice adds,
22 pages and 22 tabs. Every one of the 20 descriptions still carries a `// GUESS —` comment.

**Route guards**, read from `apps/web/src/App.tsx`: `/admin/schedule-of-rates` (line 613) and
`/workers/job-roles` (line 377) are bare `<Route>` elements. Their neighbours at lines 528, 541,
549, 558 and 570 are each wrapped in `<RequirePermissions>`. These two are not.

## WHAT CHANGED

Nothing in the repository. Two artifacts were published, and one prompt plus this breadcrumb are
staged for Marco to arm.

**Published** (each is now the one identity for its design; never republish either to a new URL):

| Artifact | id | Rebuilt from |
|---|---|---|
| Theme Builder | `330c3e98` | D38/D39, `BrandColorScheme`, `BrandAssetKind`, `AdminCompanyPage.tsx:883-899`, `tokens.css` |
| Settings Home | `524ef7db` | `docs/plans/settings-home-plan.md` (D43–D47) and the staged settings-home prompt |

**Staged, not armed:** `pr-artifactregister-s2-name-what-is-missing-HOLD.md` — one file, size 1,
`docs/design/ARTIFACT-REGISTER.md` only. Lints **ADMIT (size 1)**, exit 0.

## FINDINGS

1. **The two "lost artifacts" were PDF filenames all along.** A brief cited as a filename is not
   findable from the tracked tree, which is the exact defect the artifact register was built to
   fix — the register indexes what exists and was silent about what does not. **ACTIONED** — the
   staged prompt adds a `## Known missing` section naming all three, what cites each, and where
   its content actually survives, plus the rule: when a design is approved, put its artifact URL
   in the register in the same change.

2. **Both rebuilds were faithful, not invented.** The settings-home prompt transcribes Marco's
   approved description for 19 of the 20 pages, and the plan document carries D43–D47 and the full
   item inventory; the theme-builder spec survives in D38/D39 plus the branding schema. Neither
   rebuild required a guess about intent. **ACTIONED** — both published and registered.

3. **`/admin/schedule-of-rates` and `/workers/job-roles` carry no permission guard.** The staged
   settings-home prompt instructs the implementer to "match the guard already on that route" and
   to "not invent a permission". Measured, that instruction resolves to *there is no guard*: any
   signed-in user can open both today. So a card for either would be drawn as open to everyone —
   correct if the pages are genuinely open, and an advertisement of two ungated admin screens if
   they are not. **ESCALATED** — Marco must rule before `pr-settings-home-s1` is armed. The
   rebuilt mock-up marks both cards `no route guard` so the question cannot be missed.

4. **The old settings mock-up was stale in three specific ways**, each already recorded in the
   staged prompt and now visible in the rebuild: it printed `11 · 21 · 10` and claimed "30 pages,
   47 searchable entries" against a real 22 and 22; it gave Account three tabs and Reference data
   a fifth that the code does not declare; and it omitted CRM drop reasons, which exists.
   **ACTIONED** — the rebuild computes every count from the item list and shows a persona switcher
   so the numbers visibly move, rather than printing any of them.

5. **`erp-theme-system-mockup` is still not located.** It is referenced in conversation only; no
   tracked file cites it. **DEFERRED** — recorded in the register's new section as Open, so the
   next reader inherits the search rather than repeating it.

6. **`CRM drop reasons` keeps a GUESS description.** The approved-copy table in the settings-home
   prompt covers 19 of 20 pages and deliberately excludes it. **DEFERRED** — one line of copy from
   Marco closes it; the rebuilt mock-up marks that card `guess` so it is not mistaken for approved.

## WHAT I DID NOT DO

- I did not arm anything, and I did not merge anything. The staged prompt is `-HOLD.md`.
- I did not edit `docs/design/ARTIFACT-REGISTER.md` myself. The prompt describes the edit; the
  implementer makes it.
- I did not touch `docs/pr-prompts/pr-settings-home-s1-cards-tabs-counts-HOLD.md`, including its
  now-questionable "match the guard already on that route" instruction. That is finding 3 and it
  is Marco's ruling, not my edit.
- I did not search Marco's Downloads or Desktop for the two PDFs. Access was requested once and
  the dialog timed out; per the tool's own rule I did not ask a second time.
- I did not add the tabs the old mock-up showed but the code does not declare, and I did not
  invent a permission for the two unguarded routes.
- I did not rewrite the register's historical "29 of 32" measurement, and I did not remove or
  reorder any existing row.
- I did not run `git checkout .`, `reset --hard`, `stash pop` or `git clean` anywhere.
