-- Knowledge Base / SOP library (case management slice 2).
--
-- Adds:
--   * KbArticleStatus enum  (DRAFT | PUBLISHED)
--   * kb_articles table — id, title, body, category, tags (text[]),
--     status, author_id, created_at, updated_at
--   * Indexes on status, category, author_id

-- Enum
CREATE TYPE "KbArticleStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- Table
CREATE TABLE "kb_articles" (
    "id"          TEXT         NOT NULL,
    "title"       TEXT         NOT NULL,
    "body"        TEXT         NOT NULL,
    "category"    TEXT         NOT NULL,
    "tags"        TEXT[]       NOT NULL DEFAULT ARRAY[]::TEXT[],
    "status"      "KbArticleStatus" NOT NULL DEFAULT 'DRAFT',
    "author_id"   TEXT         NOT NULL,
    "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"  TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kb_articles_pkey" PRIMARY KEY ("id")
);

-- FK to users
ALTER TABLE "kb_articles" ADD CONSTRAINT "kb_articles_author_id_fkey"
    FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Indexes
CREATE INDEX "kb_articles_status_idx"    ON "kb_articles"("status");
CREATE INDEX "kb_articles_category_idx"  ON "kb_articles"("category");
CREATE INDEX "kb_articles_author_id_idx" ON "kb_articles"("author_id");
