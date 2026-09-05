# Station 06 — 2026-09-05 05:30Z — ADDENDUM: the three mock-ups were found, and my earlier claim was wrong

Addendum to `00-06-pr-master-2026-09-05-0515-two-lost-mockups-were-pdfs-not-artifacts-and-both-are-rebuilt.md`.
It stands except where corrected below.

## GROUND

Same run, same PR (#1643), branch `station06/artifact-register-s2-known-missing`. Marco granted the
search at 05:2xZ. The Cowork folder-access dialog timed out twice on his laptop, so the search ran
through the Windows-side shell instead, read-only, over his user profile.

## WHAT I MEASURED

All three files exist. Measured 2026-09-05 05:2xZ:

| file | size | modified (local) |
|---|---|---|
| `C:\Users\Marco\Downloads\erp-settings-home-mockup.pdf` | 170,981 B | 2026-09-01 12:44 |
| `C:\Users\Marco\Downloads\erp-theme-builder-mockup.pdf` | 135,093 B | 2026-09-01 12:44 |
| `C:\Users\Marco\Downloads\theme-system-mockup.html` | 18,217 B | 2026-08-17 12:58 |

Both PDFs carry `Producer: Skia/PDF`, `Creator: Chromium` — they are HTML mock-ups printed to PDF
from a browser, not documents authored as PDFs. Titles as embedded: "Settings Home — mock-up
(§2.2 / §2.3)" (4 pages) and "Brand & theme — settings mock-up" (3 pages).

Copies were taken into `C:\po-preserve\drafts\station06-20260905\`. **Nothing in Downloads was
moved, renamed or deleted.**

## WHAT CHANGED

The staged prompt was corrected on the branch before merge. Its section heading changes from
`## Known missing` to `## Held outside the tree - approved designs that were never published`,
and `premise`/`done_when` were re-pointed at the new token. It still lints **ADMIT (size 1)**,
exit 0.

The two published pages were compared against the recovered originals and both hold up:

- **Settings Home** (`524ef7db`) — same cards, same approved descriptions, same monospace route
  and `needs <permission>` lines, same Request access buttons, same All items / Grouped toggle and
  locked divider. Two cosmetic differences: the original's rail is dark teal where the rebuild
  used black (`tokens.css --surface-sidebar: #000000`), and the original titles the card "Company
  profile" where the rebuild uses "Company", the label `settings-nav-items.ts` actually declares.
- **Theme Builder** (`330c3e98`) — same five schemes (IS Teal / Initial / Graphite / Harbour /
  Custom), same palette rows with live contrast grades, same four brand-file tiles, same density
  control and live preview with a light/dark switch.

## FINDINGS

1. **My 05:15 claim that the mock-ups were "held nowhere" was wrong.** They were never artifacts —
   that part holds — but they are not lost: they are browser downloads on Marco's laptop. I
   asserted absence from two searches (gallery, repo) without the third search having been
   possible, and stated it as fact rather than as the bounded measurement it was. **ACTIONED** —
   the prompt now says what is true, and says it in a way that names where they live and why the
   tree still cannot see them.

2. **The originals confirm the rebuilds rather than replace them.** Neither published page needs
   to be redrawn. The recovered PDFs also confirm the staleness the staged settings-home prompt
   already recorded: the original prints `11 · 21 · 10` and "30 pages … 47 searchable entries",
   gives Account three tabs and Reference data a fifth (Densities), and omits CRM drop reasons.
   **ACTIONED** — both pages' build notes updated to say the original is recovered and where it is.

3. **The real risk was never that the designs were lost — it is where they live.** An approved
   design sitting in a Downloads folder is invisible to every agent that searches the tree and one
   folder cleanup from gone. **ACTIONED** — that is now the rule the register section states.

4. **`theme-system-mockup.html` (2026-08-17) is the third file and is still unpublished.** It is
   the predecessor of the Brand & theme design and no tracked file cites it. **DEFERRED** — listed
   in the register as Open; publishing it is Marco's call, not mine.

## WHAT I DID NOT DO

- I did not move, rename, delete or modify anything in `C:\Users\Marco\Downloads`. Copies only.
- I did not publish `theme-system-mockup.html`, and I did not fold it into either existing page.
- I did not redraw either published page to match the PDFs pixel-for-pixel. They were built from
  the spec, they agree with the original in substance, and the two cosmetic differences are noted
  above rather than silently reconciled.
- I did not amend the 0515 breadcrumb. It is left standing with this addendum against it, so the
  wrong claim and its correction are both on the record.
- I did not merge or arm anything.
