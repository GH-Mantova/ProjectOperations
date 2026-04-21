-- Scope of Works — interactive QS sheet between tender docs and the estimate.

CREATE TABLE "scope_of_works_items" (
  "id"                      TEXT         NOT NULL,
  "tender_id"               TEXT         NOT NULL,
  "wbs_code"                TEXT         NOT NULL,
  "discipline"              TEXT         NOT NULL,
  "item_number"             INTEGER      NOT NULL,
  "row_type"                TEXT         NOT NULL,
  "description"             TEXT         NOT NULL,
  "status"                  TEXT         NOT NULL DEFAULT 'confirmed',
  "ai_proposed"             BOOLEAN      NOT NULL DEFAULT false,
  "ai_confidence"           TEXT,
  "ai_source_ref"           TEXT,
  "sort_order"              INTEGER      NOT NULL DEFAULT 0,
  "notes"                   TEXT,
  "men"                     DECIMAL(8,2),
  "days"                    DECIMAL(8,2),
  "shift"                   TEXT,
  "sqm"                     DECIMAL(10,2),
  "m3"                      DECIMAL(10,2),
  "material_type"           TEXT,
  "cutting_equipment"       TEXT,
  "elevation"               TEXT,
  "depth_mm"                INTEGER,
  "lm"                      DECIMAL(10,2),
  "core_hole_diameter_mm"   INTEGER,
  "core_hole_qty"           DECIMAL(10,2),
  "acm_type"                TEXT,
  "acm_material"            TEXT,
  "enclosure_required"      BOOLEAN,
  "air_monitoring"          BOOLEAN,
  "excavation_depth_m"      DECIMAL(8,2),
  "excavation_material"     TEXT,
  "machine_size"            TEXT,
  "waste_type"              TEXT,
  "waste_facility"          TEXT,
  "waste_tonnes"            DECIMAL(10,3),
  "waste_loads"             INTEGER,
  "waste_m3"                DECIMAL(10,2),
  "excavator_days"          DECIMAL(8,2),
  "bobcat_days"             DECIMAL(8,2),
  "ewp_days"                DECIMAL(8,2),
  "hook_truck_days"         DECIMAL(8,2),
  "semi_tipper_days"        DECIMAL(8,2),
  "asset_id"                TEXT,
  "estimate_item_id"        TEXT,
  "created_by_id"           TEXT         NOT NULL,
  "created_at"              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"              TIMESTAMP(3) NOT NULL,
  CONSTRAINT "scope_of_works_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "scope_of_works_items_tender_id_discipline_item_number_idx"
  ON "scope_of_works_items"("tender_id", "discipline", "item_number");
CREATE INDEX "scope_of_works_items_tender_id_status_idx"
  ON "scope_of_works_items"("tender_id", "status");

ALTER TABLE "scope_of_works_items" ADD CONSTRAINT "scope_of_works_items_tender_id_fkey"
  FOREIGN KEY ("tender_id") REFERENCES "tenders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "scope_of_works_items" ADD CONSTRAINT "scope_of_works_items_created_by_id_fkey"
  FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "scope_of_works_headers" (
  "id"                  TEXT         NOT NULL,
  "tender_id"           TEXT         NOT NULL,
  "site_address"        TEXT,
  "site_contact_name"   TEXT,
  "site_contact_phone"  TEXT,
  "access_constraints"  TEXT,
  "proposed_start_date" TIMESTAMP(3),
  "duration_weeks"      INTEGER,
  "special_conditions"  TEXT,
  "updated_at"          TIMESTAMP(3) NOT NULL,
  CONSTRAINT "scope_of_works_headers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "scope_of_works_headers_tender_id_key" ON "scope_of_works_headers"("tender_id");

ALTER TABLE "scope_of_works_headers" ADD CONSTRAINT "scope_of_works_headers_tender_id_fkey"
  FOREIGN KEY ("tender_id") REFERENCES "tenders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
