-- Interactive SWMS — template catalog (SLICE A1). Additive.
--
-- Static, versioned catalog of SWMS templates. A template (e.g. Rev 5) has
-- ordered sections; each section groups controls; each control expands into
-- one or more control rows carrying hazard / risk / PPE detail.
--
-- Natural keys drive seed idempotency: the A2 seed upserts on template code,
-- section number (within template), control code (within section), and row
-- code (within control) — never on the autoincrement id, so re-runs converge
-- and future Rev revisions extend the catalog without id drift.

-- CreateTable
CREATE TABLE "swms_templates" (
    "id"         TEXT NOT NULL,
    "code"       TEXT NOT NULL,
    "title"      TEXT NOT NULL,
    "revision"   TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "swms_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "swms_template_sections" (
    "id"          TEXT NOT NULL,
    "template_id" TEXT NOT NULL,
    "number"      INTEGER NOT NULL,
    "order"       INTEGER NOT NULL,
    "title"       TEXT NOT NULL,
    "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"  TIMESTAMP(3) NOT NULL,

    CONSTRAINT "swms_template_sections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "swms_template_controls" (
    "id"            TEXT NOT NULL,
    "section_id"    TEXT NOT NULL,
    "code"          TEXT NOT NULL,
    "order"         INTEGER NOT NULL,
    "heading_label" TEXT NOT NULL,
    "sub_label"     TEXT,
    "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"    TIMESTAMP(3) NOT NULL,

    CONSTRAINT "swms_template_controls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "swms_template_control_rows" (
    "id"          TEXT NOT NULL,
    "control_id"  TEXT NOT NULL,
    "code"        TEXT NOT NULL,
    "order"       INTEGER NOT NULL,
    "hazard"      TEXT NOT NULL,
    "risk_before" TEXT NOT NULL,
    "controls"    TEXT NOT NULL,
    "risk_after"  TEXT NOT NULL,
    "ppe"         TEXT,
    "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"  TIMESTAMP(3) NOT NULL,

    CONSTRAINT "swms_template_control_rows_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "swms_templates_code_key" ON "swms_templates"("code");

-- CreateIndex
CREATE UNIQUE INDEX "swms_template_sections_template_id_number_key"
  ON "swms_template_sections"("template_id", "number");

-- CreateIndex
CREATE INDEX "swms_template_sections_template_id_order_idx"
  ON "swms_template_sections"("template_id", "order");

-- CreateIndex
CREATE UNIQUE INDEX "swms_template_controls_section_id_code_key"
  ON "swms_template_controls"("section_id", "code");

-- CreateIndex
CREATE INDEX "swms_template_controls_section_id_order_idx"
  ON "swms_template_controls"("section_id", "order");

-- CreateIndex
CREATE UNIQUE INDEX "swms_template_control_rows_control_id_code_key"
  ON "swms_template_control_rows"("control_id", "code");

-- CreateIndex
CREATE INDEX "swms_template_control_rows_control_id_order_idx"
  ON "swms_template_control_rows"("control_id", "order");

-- AddForeignKey
ALTER TABLE "swms_template_sections" ADD CONSTRAINT "swms_template_sections_template_id_fkey"
  FOREIGN KEY ("template_id") REFERENCES "swms_templates"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "swms_template_controls" ADD CONSTRAINT "swms_template_controls_section_id_fkey"
  FOREIGN KEY ("section_id") REFERENCES "swms_template_sections"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "swms_template_control_rows" ADD CONSTRAINT "swms_template_control_rows_control_id_fkey"
  FOREIGN KEY ("control_id") REFERENCES "swms_template_controls"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
