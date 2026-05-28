# Tendering Module — Smoke Test Report

- **Date:** 2026-05-26
- **Author:** Cowork (live Chrome smoke-test via Claude in Chrome extension on "Work laptop")
- **Tenders exercised:** created IS-T999 (test, then deleted) + existing IS-T100 (template, retained)
- **Method:** live browser drive through the running dev app at `http://localhost:5173`; Marco watched.

---

## §1 — Summary

Broad-strokes smoke test of the Tendering module covering tender lifecycle (create → edit → status transitions → typed-confirm delete), Scope of Works structure (cards / items / subtables / markup), and Quote → PDF export. Most flows pass. Four defects + several observations logged. Coverage favoured **breadth over depth** — not every individual field was exhaustively exercised. See §5 for what was not covered.

The headline: **§5A.2 Quote → PDF export works end-to-end from the live UI** — both PDF triggers (toolbar "PDF" and bottom "Download PDF quote") generate exports and land them in the export history.

---

## §2 — What passed

### Tender lifecycle
- Tender create via the 6-field new-tender form.
- Status transitions DRAFT → IN_PROGRESS → AWARDED (each saves and re-renders).
- Probability dropdown (Hot / Warm / Cold / Not set).
- Inline Scope-notes edit (save-on-blur).
- Add client modal — type-ahead search returns matches, click Add wires the client to the tender, modal closes automatically.
- AWARDED status surfaces a contextual **"Convert to project →"** button — good UX, only renders when applicable.
- **Delete dialog (PR #227)** renders exactly as spec'd: correct title, "permanent and irreversible" warning, **typed-confirmation gate** active for AWARDED status, Delete button disabled until the ref is typed. Cancel works; Delete + redirect to pipeline works; tender removed from DB.

### Scope of Works
- Cards-as-tabs UX with URL deep-linking (`?card=…`).
- All four discipline tabs (DEM / CIV / ASB / Other) render their items.
- Per-card discipline dropdown (allows changing a card's discipline post-creation).
- Tender-level markup % + Reset-all-overrides + per-card markup override.
- **Scope-item form is comprehensive** — confirmed all of: WBS code, description, MEN, DAYS, plant clusters (10+ equipment types, "Add Plant column"), dimensions (length / height / depth / density with auto-computed sqm / m³ / tonnes), waste group + waste item dropdowns, "Include in waste summary" and "Include in cutting summary" checkboxes, per-item notes (expandable).
- **Per-card waste subtable** — "+ Add waste row", "Sum from above" aggregator, shared WASTE NOTES.
- **Per-card cutting subtable** with 3 sub-tabs (Saw cuts / Core holes / Other), "+ Add saw cut", "Copy from above" (auto-creates from scope items where "Cutting?" is ticked), shared CUTTING NOTES.
- Per-card subtotal with both pre-markup and with-markup figures displayed.

### Quote
- Quote tab renders cost summary (5 discipline rows + Total), Assumptions (6 entries), Exclusions (11 entries), all 21 T&C clauses (each editable, each with a "Reset to standard" button).
- Action toolbar: Edit, Create next revision (supersedes current), PDF, Send, Delete quote, Recalculate, "+ Add".
- Inline-editable assumptions + exclusions with drag handles for reorder and delete buttons.
- **PDF export works end-to-end** via both the toolbar PDF button and the bottom "Download PDF quote" button. Generations appear in the EXPORT HISTORY list with timestamp + author.

---

## §3 — Defects found

### DEFECT 1 — Status dropdown inconsistency between create form and detail page
The status dropdown labels and option set differ between the New Tender form and the Tender Detail page. Same underlying values, different labels — and the **detail page is missing the `CONTRACT_ISSUED` option entirely**.

| Value | Create form label | Detail page label |
|---|---|---|
| `DRAFT` | Draft | Identified |
| `IN_PROGRESS` | Estimating | In Progress |
| `SUBMITTED` | Submitted | Submitted |
| `AWARDED` | Awarded | Awarded |
| `CONTRACT_ISSUED` | **Contract** | **(missing)** |
| `LOST` | Lost | Lost |
| `WITHDRAWN` | Withdrawn | Withdrawn |

**Impact:** a user can set the status to `CONTRACT_ISSUED` at creation but cannot transition into it from the detail page. Labels disagree across surfaces ("Draft" vs "Identified", "Estimating" vs "In Progress") — confusing.

**Recommendation:** pick one canonical label set and apply it everywhere; restore `CONTRACT_ISSUED` to the detail-page dropdown.

### DEFECT 2 — Activity timeline Post discards user-typed content
Typing into the Activity timeline "Add a note…" input and clicking **Post** resulted in a timeline entry that displayed only an auto-log of an earlier scope-notes edit (`"Quick edit by Alex Admin: notes"`), not the typed content. User input appears to have been silently discarded.

**Reproduction:**
1. On a tender's Overview tab, edit any auto-logged field (e.g. Scope notes).
2. Type something into the Activity timeline "Add a note…" input.
3. Click Post.
4. **Result:** only the auto-log entry appears; the typed post is gone.

### DEFECT 3 — Phantom unsaved draft in Clarifications & Communications
On a fresh tender detail page, after some unrelated edits, a banner appears in the Clarifications & Communications panel:

> 📝 You have an unsaved draft from just now. Restore draft / Discard

Triggered without ever clicking "+ Add entry" or interacting with the Clarifications form at all. The draft **persists across reads** (likely localStorage) and the "just now" timestamp ticks forward over time (observed it go from "just now" → "1 minutes ago" → "2 minutes ago" → "3 minutes ago" across the session).

**Likely cause:** a draft for some other feature (perhaps the Activity timeline Post, the Description edit, or a global "+ Add entry" interaction) is being stored under a key that the Clarifications panel reads, OR every panel that supports drafts is sharing one localStorage key. May share a root cause with DEFECT 2.

### DEFECT 4 — Delete dialog cascade list omits `tenderClients`
The ConfirmDeleteDialog (PR #227) shows cascade counts for `clientQuotes`, `scopeCards`, `scopeItems`, `tenderDocuments`, and `estimateExports` — but **not `tenderClients`**. A tender with linked clients gets cleanly cascade-deleted via Prisma, but the user is not warned that the client links will be removed.

Minor info gap, not a data-safety issue (clients themselves survive, only the link records are deleted). Recommend adding a `tenderClients` line to the cascade list.

---

## §4 — Observations (not defects)

- **Live Quote totals diverge from the seed sample.** The live IS-T100 Quote shows cost summary totalling **$157,060** (computed from scope-item math). The static seed sample PDF I reviewed earlier showed **$560,000** (cost-line override values per the seed). The override values appear to have been overwritten by scope-math at some point — possibly via a Recalculate click. Not a defect, but if Sean's sign-off relies on specific values, those need to be reseeded or re-set before he sees it.
- **Create-tender form is minimal** (6 fields). Client / estimator / site / proposed-start / lead-time / probability assignment happens on the detail page after creation. Workable.
- **Auto-log timeline entries** on field changes (e.g. scope-notes edit → "Quick edit by Alex Admin: notes") — good audit-trail behaviour, exists separately from the manual Post path.
- **Per-card subtotal** display includes both pre-markup and with-markup figures (e.g. Other card: $40,000 → $52,000 with 30% markup).

---

## §5 — Not exercised / known limitations

Coverage gaps — areas where the smoke test did not exhaustively cover every interaction:

- **Description inline-edit save flow.** The "Click to edit" affordance opens an editor that closed before I could fill it programmatically (refs invalidated by re-renders between batched actions). UX is likely fine for manual use; couldn't verify the save round-trip.
- **Field-level functional verification on Scope of Works items.** Bumped DEM1.1 MEN from 4 → 5 but couldn't observe the resulting line-total recompute via the text-extraction tool. The math may be working; needs a focused manual check.
- **Document upload.** Required attaching a file; skipped this session.
- **Clarifications "+ Add entry" / Follow-ups "+ Add" / Activity Post (deeper)** — only observed in passing.
- **Duplicate tender.** Not exercised.
- **Add card (Scope of Works) / Rename card / Delete card / Reorder cards** — not exercised.
- **Sum from above (waste) / Copy from above (cutting)** — buttons confirmed to exist; click-through not tested.
- **Quote actions** — Edit / Create next revision / Send / Delete quote / Recalculate / "+ Add" — not exercised. Only PDF export tested.
- **Quote: editing assumptions / exclusions / T&C clauses** — controls confirmed to exist; not exercised.
- **Quote: Excel export.** Not exercised.
- **Status transitions to `SUBMITTED`, `LOST`, `WITHDRAWN`** — not exercised individually.
- **Pipeline-board #226 Withdrawn-column layout fix** — could not visually verify because no tender was in WITHDRAWN status. Recommend manually transitioning a tender to Withdrawn and eyeballing the board.
- **Convert to project workflow** — out of scope (post-Award workflow, not Tendering).
- **AI Tendering Assistant** — out of scope of the original ask (the tendering *menu*, not the persona).
- **Tender file-document deletion** — Trash icons exist on referenced drawings on the Overview tab (e.g. `"Delete Demolition Plan — Ground Floor (DA-100 Rev C)"`) but I did not click them.

---

## §6 — Recommendation

Two clear fix priorities, neither blocking the §5A.2 Sean sign-off:

1. **DEFECT 1** (status label inconsistency + missing `CONTRACT_ISSUED` option on detail page). UX clarity issue. Small fix.
2. **DEFECTS 2 + 3** (Activity Post discards typed content + Phantom Clarifications draft). Both look like client-side draft / state-management bugs and may share a root cause (a localStorage key shared across features). Worth investigating together.

**DEFECT 4** (cascade list omits `tenderClients`) is cosmetic — add to a polish list.

The §5A.2 Quote PDF pipeline works end-to-end from the live UI, which was the most load-bearing thing to verify after the #220–#228 chain. That's clean.

*Report produced by Cowork. Not committed by Cowork — local-only diagnostic per established convention.*
