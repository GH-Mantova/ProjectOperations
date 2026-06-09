# 14. Documents

## Purpose

Generic document workspace — files attached to any entity (client,
subcontractor, project, contract). Sits on top of the SharePoint
adapter layer. Distinct from Tender Documents (which has its own
tightly-coupled drawing tools).

## Surface area

**Routes (frontend):**
- `/documents` — `DocumentsWorkspacePage` (context tree + list with
  drag-and-drop upload zone)

**API endpoints (key):**
- `POST /api/v1/documents` (multipart) — upload via FileInterceptor
- `POST /api/v1/documents/:id/versions` (multipart) — new version
- `GET /api/v1/documents?entityType=&entityId=` — scoped list
- `DELETE /api/v1/documents/:id`
- `GET /api/v1/documents/:id/download` — fresh URL each call

**DB entities:**
- `DocumentLink` (entityType, entityId, version, sharePointPath)
- `SharePointAuditLog`

## What should work (functional checklist)

- [ ] Context tree on left: entity type → entity → folder
- [ ] List on right: filename, version, uploaded by, uploaded at, size
- [ ] Drag-and-drop upload zone
- [ ] Multi-file upload
- [ ] Filename sanitisation (special chars, spaces, unicode)
- [ ] Versioning: new version goes to `POST /documents/:id/versions`,
      not as a fresh record
- [ ] Download fresh URL — never stale
- [ ] Delete with confirmation
- [ ] Empty state when entity has no documents
- [ ] Loading skeleton

## Recent PRs that shaped it (last ~100 merged)

- #22 — S7 documents foundation
- #80 — SharePoint live (underlying adapter)
- #106 — Subcontractor doc upload tab + prequal validation +
  contact reassignment — **functional / SubDoc-scoped**
- #146 — Mock adapter persists locally + downloadFileBytes
- #304 (instructions reference) — auto-folder + canonical categories

## What to watch for during sanity check

- **Drag-and-drop upload** — verify it works on Firefox + Chromium +
  WebKit (Playwright covers Chromium + Firefox + WebKit).
- **Version sub-table** — uploading a file with the same name should
  prompt: replace as new version vs upload separately.
- **Audit log entries** — every upload/download recorded.
- **Cross-entity move** — does the UI allow moving a doc between entities?
  If not, that's expected; if it does, verify cascade behaviour.

## Edge cases worth probing

- **Upload during slow network** — progress indicator, cancel
- **Upload 1GB file** — should fail gracefully or queue
- **Special characters in filename** — handled
- **Concurrent upload of same filename** — second upload becomes
  v2 or errors
- **Delete document referenced from another module** — orphan or
  block?
- **Mobile width** — drag-drop falls back to file picker; verify
- **Permission-gated** — entity-level permissions; user can only see
  docs on entities they can access
