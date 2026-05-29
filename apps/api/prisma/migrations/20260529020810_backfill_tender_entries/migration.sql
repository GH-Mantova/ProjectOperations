-- PR #18 — backfill tender_entries from the three legacy Overview-tab
-- tables (tender_notes / tender_clarifications + tender_clarification_notes
-- / tender_follow_ups). Idempotent — each INSERT guards with NOT EXISTS
-- on a deterministic migrated_* id derived from the source row id, so
-- re-running on an already-migrated DB is a no-op.
--
-- Legacy tables stay one release cycle; a follow-up PR drops them.

-- ── tender_notes → entries (type='note') ─────────────────────────────────
-- Source rows with NULL author_user_id are skipped — TenderEntry.authorId
-- is NOT NULL and the legacy data has no salvageable fallback for those
-- handful of rows.
INSERT INTO tender_entries (id, tender_id, type, body, author_id, status, created_at, updated_at)
SELECT
  concat('migrated_note_', tn.id),
  tn.tender_id,
  'note',
  tn.body,
  tn.author_user_id,
  'open',
  tn.created_at,
  tn.created_at
FROM tender_notes tn
WHERE tn.author_user_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM tender_entries te WHERE te.id = concat('migrated_note_', tn.id)
  );

-- ── tender_clarifications → entries (type='rfi') ─────────────────────────
-- The legacy clarification has no author column. Fall back to the oldest
-- super-user; if none exist, fall back to the oldest user. If the users
-- table is empty (clean install) the WHERE NOT EXISTS guard keeps the
-- INSERT a no-op via the subquery returning NULL → NOT NULL violation
-- skipped by the additional IS NOT NULL guard.
INSERT INTO tender_entries (id, tender_id, type, subject, body, due_date, status, author_id, created_at, updated_at)
SELECT
  concat('migrated_clar_', tc.id),
  tc.tender_id,
  'rfi',
  tc.subject,
  COALESCE(NULLIF(tc.response, ''), tc.subject),
  tc.due_date,
  CASE WHEN UPPER(tc.status) = 'OPEN' THEN 'open' ELSE 'done' END,
  COALESCE(
    (SELECT u.id FROM users u WHERE u.is_super_user = TRUE ORDER BY u.created_at LIMIT 1),
    (SELECT u.id FROM users u ORDER BY u.created_at LIMIT 1)
  ),
  tc.created_at,
  tc.updated_at
FROM tender_clarifications tc
WHERE EXISTS (SELECT 1 FROM users)
  AND NOT EXISTS (
    SELECT 1 FROM tender_entries te WHERE te.id = concat('migrated_clar_', tc.id)
  );

-- ── tender_clarification_notes → entries (type from note_type) ──────────
-- noteType in {'call', 'email', 'meeting', 'note', 'response'}.
-- 'response' is folded into 'note' since TenderEntry has no 'response'
-- type — the response is still a note on the thread, just from the other
-- party.
INSERT INTO tender_entries (id, tender_id, type, body, author_id, status, created_at, updated_at)
SELECT
  concat('migrated_clarnote_', tcn.id),
  tcn.tender_id,
  CASE tcn.note_type
    WHEN 'call' THEN 'call'
    WHEN 'email' THEN 'email'
    WHEN 'meeting' THEN 'meeting'
    WHEN 'response' THEN 'note'
    ELSE 'note'
  END,
  tcn.text,
  tcn.created_by_id,
  'open',
  tcn.occurred_at,
  tcn.created_at
FROM tender_clarification_notes tcn
WHERE NOT EXISTS (
  SELECT 1 FROM tender_entries te WHERE te.id = concat('migrated_clarnote_', tcn.id)
);

-- ── tender_follow_ups → entries (type='follow_up') ───────────────────────
-- The legacy follow-up has no native author. Use the assigned user as
-- author when present, otherwise fall back to the oldest super-user / any
-- user. Status mapping: OPEN → open, DONE → done, CANCELLED → cancelled.
INSERT INTO tender_entries (id, tender_id, type, body, due_date, assignee_id, status, author_id, created_at, updated_at)
SELECT
  concat('migrated_followup_', tfu.id),
  tfu.tender_id,
  'follow_up',
  tfu.details,
  tfu.due_at,
  tfu.assigned_user_id,
  CASE UPPER(tfu.status)
    WHEN 'OPEN' THEN 'open'
    WHEN 'DONE' THEN 'done'
    WHEN 'CANCELLED' THEN 'cancelled'
    ELSE 'open'
  END,
  COALESCE(
    tfu.assigned_user_id,
    (SELECT u.id FROM users u WHERE u.is_super_user = TRUE ORDER BY u.created_at LIMIT 1),
    (SELECT u.id FROM users u ORDER BY u.created_at LIMIT 1)
  ),
  tfu.created_at,
  tfu.updated_at
FROM tender_follow_ups tfu
WHERE EXISTS (SELECT 1 FROM users)
  AND NOT EXISTS (
    SELECT 1 FROM tender_entries te WHERE te.id = concat('migrated_followup_', tfu.id)
  );
