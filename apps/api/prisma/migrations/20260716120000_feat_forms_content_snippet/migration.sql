-- Migration: feat_forms_content_snippet
-- Adds the FormContentSnippet table (reusable HTML content blocks)
-- and a soft-reference column on form_fields for content_block fields.

-- CreateTable
CREATE TABLE "form_content_snippets" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'general',
    "body_html" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "form_content_snippets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "form_content_snippets_code_key" ON "form_content_snippets"("code");

-- CreateIndex
CREATE INDEX "form_content_snippets_category_idx" ON "form_content_snippets"("category");

-- CreateIndex
CREATE INDEX "form_content_snippets_is_active_idx" ON "form_content_snippets"("is_active");

-- AlterTable: add nullable snippet_code to form_fields
ALTER TABLE "form_fields" ADD COLUMN "snippet_code" TEXT;

-- CreateIndex
CREATE INDEX "form_fields_snippet_code_idx" ON "form_fields"("snippet_code");
