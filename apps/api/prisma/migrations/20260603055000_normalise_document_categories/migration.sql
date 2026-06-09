-- PR-64 — Normalise tender_document_links.category onto the canonical
-- 11-category list used by the SharePoint folder structure. Mirrors the
-- TypeScript normaliseDocumentCategory helper. Legacy values that don't
-- alias cleanly fall back to 'Other' so no data is lost.
--
-- document_links (the general document registry) is intentionally NOT
-- migrated — different modules use different category conventions
-- (Maintenance, Evidence, Award) and those stay valid in their context.

UPDATE "tender_document_links"
SET category = CASE
  WHEN category IN (
    'Tender Documents',
    'Drawings',
    'Specifications',
    'Bill of Quantities',
    'Quotes — Subcontractor or Supplier',
    'Submissions',
    'Correspondence',
    'Compliance & WHS',
    'Asbestos',
    'Site Photos',
    'Other'
  ) THEN category
  WHEN LOWER(TRIM(category)) IN ('tender', 'rft') THEN 'Tender Documents'
  WHEN LOWER(TRIM(category)) IN ('drawing', 'drawings') THEN 'Drawings'
  WHEN LOWER(TRIM(category)) IN ('spec', 'specs', 'specification', 'specifications') THEN 'Specifications'
  WHEN LOWER(TRIM(category)) IN ('boq', 'bill of quantities') THEN 'Bill of Quantities'
  WHEN LOWER(TRIM(category)) IN ('quote', 'quotes') THEN 'Quotes — Subcontractor or Supplier'
  WHEN LOWER(TRIM(category)) IN ('submission', 'submissions') THEN 'Submissions'
  WHEN LOWER(TRIM(category)) IN ('correspondence', 'email', 'emails', 'award', 'award letter') THEN 'Correspondence'
  WHEN LOWER(TRIM(category)) IN ('whs', 'swms', 'compliance', 'compliance and whs') THEN 'Compliance & WHS'
  WHEN LOWER(TRIM(category)) IN ('asbestos', 'hazmat', 'asbestos register') THEN 'Asbestos'
  WHEN LOWER(TRIM(category)) IN ('site photos', 'site photo', 'photos') THEN 'Site Photos'
  ELSE 'Other'
END;
