# 3. SharePoint + Platform Services Foundation

## Purpose

The file-storage abstraction layer that decouples the app from SharePoint.
A `SharePointAdapter` interface with two backends: `MockSharePointAdapter`
(local disk, dev/test) and `GraphSharePointAdapter` (Microsoft Graph,
production). Tender documents, project documents, quote PDFs, drawing
tools, and the asbestos register reader all go through this layer.

Operations facing — once configured, users don't think about it; when it
breaks, every document-bearing module breaks.

## Surface area

**Routes (frontend):**
- No standalone page — used by Documents, Tender Documents, Subcontractor
  Documents, Forms attachments.

**API endpoints (key):**
- All file upload routes flow through `SharePointService`:
  - `POST /api/v1/documents` (multipart)
  - `POST /api/v1/documents/:id/versions` (multipart)
  - `POST /api/v1/tenders/:tenderId/documents` (multipart)
  - `POST /api/v1/subcontractors/:id/documents` (multipart)
- Download: server-side gets a fresh download URL on every request

**DB entities:**
- `DocumentLink` — pointer to a file in SharePoint (path, etag,
  sharePointItemId, mime, size)
- `TenderDocumentLink` — tender-scoped subclass with category
- `FileLink` — generic blob ref used by drawings + asbestos register
- `SharePointAuditLog` — every upload / download (PR #146)

**Adapter interface:**
- `ensureFolder(path)`
- `uploadFile(path, bytes, contentType)`
- `getDownloadUrl(path)`
- `downloadFileBytes(path)` — added in PR #146 for drawing tools

## What should work (functional checklist)

- [ ] `SHAREPOINT_MODE=mock` selected at module init when env var unset
      or set to `mock`
- [ ] Mock adapter persists uploaded bytes to
      `apps/api/.local-storage/sharepoint-mock` (PR #146)
- [ ] Mock adapter reads back the same bytes on download
- [ ] Upload audit log entry created on every upload (actor + path +
      size)
- [ ] Download audit log entry created on every download
- [ ] `SharePointFileNotFoundError` surfaces a user-facing "file not
      found" message (not a generic 500)
- [ ] Multi-part upload size limit honoured (don't accept multi-GB
      uploads silently)
- [ ] Filename sanitisation — special chars, spaces, unicode
- [ ] Auto-create tender folder on tender creation (PR #304 — feature)
- [ ] Canonical doc categories (PR #304) — tender, drawings, asbestos,
      contracts, etc.
- [ ] Live mode (`SHAREPOINT_MODE=live`) — adapter swaps to
      `GraphSharePointAdapter` (note: production-deferred, but the
      smoke path should not crash on swap)
- [ ] Live mode requires `SHAREPOINT_TENANT_ID`, `SHAREPOINT_CLIENT_ID`,
      `SHAREPOINT_CLIENT_SECRET`, `SHAREPOINT_SITE_HOSTNAME`,
      `SHAREPOINT_SITE_PATH`, `SHAREPOINT_LIBRARY_NAME`,
      `SHAREPOINT_TENDERS_ROOT` — missing vars produce clean error

## Recent PRs that shaped it (last ~100 merged)

- #7 — S3 SharePoint Graph adapter foundation
- #80 — SharePoint live (Microsoft Graph API document storage) —
  **functional / live mode shipped, not production-enabled**
- #146 — Mock adapter persists bytes locally, downloadFileBytes added,
  drawing tools unblocked — **functional**
- #115 — gitignore sensitive client templates
- #304 (referenced in instructions) — Auto-create tender SharePoint
  folders + canonical doc categories (functional, watch carefully)

Audit / hardening:
- PR #135 — Xero error sanitisation (similar defence-in-depth pattern
  applied to SharePoint by analogy)

## What to watch for during sanity check

- **Mock storage location** — `.local-storage/sharepoint-mock` should
  exist after the first upload. Inspect the disk and confirm the bytes
  are real PDFs / images, not zero-byte sentinels.
- **Auto-create tender folder (PR #304)** — when a new tender is
  created, the SharePoint mock should create the canonical folder
  structure under it. Verify on disk. This is recent and risk-prone.
- **Download path stability** — `getDownloadUrl` returns a fresh URL
  each call; clicking a download should never 404 because of a stale
  link.
- **Asbestos register access** — uses the same downloadFileBytes path
  (PR G / #218). Upload an XLSX-shape register and confirm the
  persona tool can read it (covered more in Tendering Assistant).
- **Live mode degradation** — `SHAREPOINT_MODE=live` without keys
  should refuse to start cleanly, not crash. Test by setting the var
  and leaving secrets unset.
- **Error envelope** — file errors should always come through with
  category prefix per the sanitisation pattern (PR #131 + #135 set the
  precedent).

## Edge cases worth probing

- **Upload 0-byte file** — should reject with a clean validation error
- **Upload binary that claims to be PDF (wrong magic bytes)** — what
  happens when the drawing tool tries to render it?
- **Same filename uploaded twice** — overwrite or versioned?
  `DocumentLink` has a versions sub-table — confirm new versions land in
  `POST /documents/:id/versions`, not as fresh records
- **Disk full on mock** — should produce a clean 500, not a silent
  partial-write
- **Special characters in filename** — `&`, `#`, spaces, unicode emoji
- **Concurrent uploads to same folder** — race on ensureFolder, FS
  contention
- **File deleted out-of-band on disk** — the DocumentLink row still
  exists but the file is gone; download should produce
  SharePointFileNotFoundError with a clean message
- **Live mode SharePoint auth expired** — graceful degrade with admin
  alert?
