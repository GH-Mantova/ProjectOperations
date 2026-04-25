-- Drop the legacy `subcontractor_contacts` table.
-- PR #75 unified ClientContact + SubcontractorContact into the polymorphic
-- `contacts` table and copied existing rows across with their original IDs.
-- The Prisma model was removed at the same time and no API code has read
-- this table since. Drop it now.

DROP TABLE IF EXISTS "subcontractor_contacts";
