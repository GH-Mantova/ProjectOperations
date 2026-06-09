# 6. Tender Documents

## Purpose

The documents tab inside a tender — drawings, asbestos registers, scope
PDFs, RFI references, contract addenda. Critical because the AI Tendering
Assistant's drawing tools and asbestos register reader read from this
surface. Also feeds quote PDFs and Excel exports indirectly.

## Surface area

**Routes (frontend):**
- `/tenders/:id` → Documents tab (`TenderDocumentsPanel`)
- Drawing tools attach via persona system, not a standalone page

**API endpoints (key):**
- `POST /api/v1/tenders/:tenderId/documents` (multipart) — upload
- `GET /api/v1/tenders/:tenderId/documents` — list
- `DELETE /api/v1/tenders/:tenderId/documents/:linkId`
- `GET /api/v1/tenders/:tenderId/documents/:linkId/download` — fresh URL
- Persona tools (read-only, AI-driven, not user-callable HTTP):
  - `list_tender_drawings`
  - `extract_drawing_titleblock`
  - `read_tender_drawing`
  - `read_asbestos_register`

**DB entities:**
- `TenderDocumentLink` — pointer to file, category (tender / drawings /
  asbestos / contracts / etc), mime, size, filename
- `FileLink` — underlying byte ref
- `SharePointAuditLog`

## What should work (functional checklist)

- [ ] Upload PDF, PNG, JPEG, XLSX, DOCX — all accepted
- [ ] Filename preserved (sanitised but readable)
- [ ] Category picker on upload (verify category list matches PR #304:
      tender / drawings / asbestos register / contract / etc)
- [ ] Auto-detect drawing vs register vs generic? (PR G / #218 — asbestos
      register auto-detected via keyword)
- [ ] List of attached documents shows: filename, category, size,
      uploaded by, uploaded at
- [ ] Download link works (fresh URL per click, no stale 404)
- [ ] Delete document removes both DB row and disk file (mock)
- [ ] File size limit enforced (multi-GB rejected with clear error)
- [ ] Tendering Assistant `list_tender_drawings` returns PDF / PNG / JPEG
      uploads only (mime-type filter per PR #145)
- [ ] `extract_drawing_titleblock` returns best-effort regex extraction
      (PHASE 6 deferral for full structured extraction)
- [ ] `read_tender_drawing` rasterises the PDF page at 1568px and replies
      with image bytes (PR #142 / #147)
- [ ] `read_asbestos_register` reads PDF text layer, image-PDF fallback,
      XLSX, DOCX (PR G / #218)
- [ ] Asbestos register auto-detected by filename keyword: "asbestos
      register", "hazmat", "ACM survey", "Division 6"
- [ ] Drawing tool failures produce categorised error messages
      (SharePointFileNotFoundError etc, PR #146)

## Recent PRs that shaped it (last ~100 merged)

- #80 — SharePoint live (Graph adapter behind feature flag)
- #142 — Drawing tools (list, extract titleblock, read) — **functional**
- #143 — Bind drawing tools to all 6 Tendering sub-modes
- #144 — Tender-context system prompt injection (CUID vs display code)
- #145 — Filter drawings by mime-type, not category — **functional /
  fix-forward, real demo drawings had `category="tender"`**
- #146 — Mock adapter persists bytes; downloadFileBytes added;
  SharePointFileNotFoundError typed — **functional**
- #147 — Image content passed on current turn instead of DB replay —
  **functional**
- #218 — `read_asbestos_register` PR G — **functional, ships register
  reader for PDF/XLSX/DOCX/image**
- #154 — `isEvalSupported: false` mitigation for pdfjs-dist CVE — security
- #304 (referenced in instructions) — Auto-create tender SharePoint
  folders + canonical doc categories — **functional**

Older support:
- #105 — PDF watermark + register header on every page via pageAdded
  (quote PDF, not tender docs, but same renderer chain)

## What to watch for during sanity check

- **Auto-folder creation (PR #304)** — when a new tender is created, the
  canonical folder structure should appear under it in the mock storage.
  Verify on disk: `.local-storage/sharepoint-mock/{tender-folder}/...`
- **Mime-type filter (PR #145)** — uploads with weird category labels
  should still surface to `list_tender_drawings` as long as the mime is
  PDF/PNG/JPEG. Test with an oddly categorised PDF.
- **Asbestos register detection (PR G)** — upload a register with one of
  the keywords in the filename; verify the persona tool picks it up.
  Upload one with a generic name; verify it does NOT auto-detect.
- **Page count is null** — `list_tender_drawings` deliberately doesn't
  parse page counts in the listing path (PR #145 dropped that). PHASE 6
  cache idea exists but not implemented.
- **Image not replayed marker** — older turns get "[image not replayed]"
  marker (PR #147). Current turn replays full image bytes. Verify the
  marker doesn't appear during a fresh conversation about the same image.
- **CVE mitigation (PR #154)** — pdfjs-dist v3 with `isEvalSupported: false`.
  Dependabot alerts #14/#15 stay open by design.

## Edge cases worth probing

- **Upload non-drawing file labelled `category=drawings`** — does the
  listing tool still surface it (mime filter governs)?
- **Upload corrupted PDF** — drawing tool should fail with clean error
- **Upload 100MB PDF** — performance, memory, rasterisation timeout
- **Upload password-protected PDF** — pdfjs-dist behaviour
- **Multi-page PDF (50+ pages)** — read_tender_drawing performance per page
- **DOCX asbestos register** — verify mammoth-based extraction
- **XLSX register with multiple sheets** — all sheets tab-delimited per
  PR G design
- **Empty Documents tab** — empty state + upload CTA
- **Delete document mid-AI-conversation** — what happens to the model's
  in-flight tool call? (PHASE 6 graceful handling area)
- **Filename with `&`, `#`, spaces, unicode** — sanitisation in URL +
  filesystem
