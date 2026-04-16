CREATE TABLE "clients" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "email" TEXT,
    "phone" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "contacts" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "position" TEXT,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "contacts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "sites" (
    "id" TEXT NOT NULL,
    "client_id" TEXT,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "address_line_1" TEXT,
    "suburb" TEXT,
    "state" TEXT,
    "postcode" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "sites_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "resource_types" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "resource_types_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "competencies" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "competencies_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "workers" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "resource_type_id" TEXT,
    "employee_code" TEXT,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "employment_type" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "workers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "crews" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "crews_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "crew_workers" (
    "id" TEXT NOT NULL,
    "crew_id" TEXT NOT NULL,
    "worker_id" TEXT NOT NULL,
    "role_label" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "crew_workers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "assets" (
    "id" TEXT NOT NULL,
    "resource_type_id" TEXT,
    "name" TEXT NOT NULL,
    "asset_code" TEXT NOT NULL,
    "serial_number" TEXT,
    "status" TEXT NOT NULL DEFAULT 'AVAILABLE',
    "home_base" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "assets_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "worker_competencies" (
    "id" TEXT NOT NULL,
    "worker_id" TEXT NOT NULL,
    "competency_id" TEXT NOT NULL,
    "achieved_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "worker_competencies_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "lookup_values" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "lookup_values_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "clients_name_key" ON "clients"("name");
CREATE UNIQUE INDEX "clients_code_key" ON "clients"("code");
CREATE UNIQUE INDEX "sites_name_key" ON "sites"("name");
CREATE UNIQUE INDEX "sites_code_key" ON "sites"("code");
CREATE UNIQUE INDEX "resource_types_name_key" ON "resource_types"("name");
CREATE UNIQUE INDEX "resource_types_code_key" ON "resource_types"("code");
CREATE UNIQUE INDEX "competencies_name_key" ON "competencies"("name");
CREATE UNIQUE INDEX "competencies_code_key" ON "competencies"("code");
CREATE UNIQUE INDEX "workers_user_id_key" ON "workers"("user_id");
CREATE UNIQUE INDEX "workers_employee_code_key" ON "workers"("employee_code");
CREATE UNIQUE INDEX "crews_name_key" ON "crews"("name");
CREATE UNIQUE INDEX "crews_code_key" ON "crews"("code");
CREATE UNIQUE INDEX "crew_workers_crew_id_worker_id_key" ON "crew_workers"("crew_id", "worker_id");
CREATE UNIQUE INDEX "assets_asset_code_key" ON "assets"("asset_code");
CREATE UNIQUE INDEX "assets_serial_number_key" ON "assets"("serial_number");
CREATE UNIQUE INDEX "worker_competencies_worker_id_competency_id_key" ON "worker_competencies"("worker_id", "competency_id");
CREATE UNIQUE INDEX "lookup_values_category_key_key" ON "lookup_values"("category", "key");

CREATE INDEX "clients_status_idx" ON "clients"("status");
CREATE INDEX "contacts_client_id_idx" ON "contacts"("client_id");
CREATE INDEX "contacts_last_name_first_name_idx" ON "contacts"("last_name", "first_name");
CREATE INDEX "sites_client_id_idx" ON "sites"("client_id");
CREATE INDEX "resource_types_category_idx" ON "resource_types"("category");
CREATE INDEX "workers_status_idx" ON "workers"("status");
CREATE INDEX "workers_resource_type_id_idx" ON "workers"("resource_type_id");
CREATE INDEX "workers_last_name_first_name_idx" ON "workers"("last_name", "first_name");
CREATE INDEX "crews_status_idx" ON "crews"("status");
CREATE INDEX "crew_workers_worker_id_idx" ON "crew_workers"("worker_id");
CREATE INDEX "assets_status_idx" ON "assets"("status");
CREATE INDEX "assets_resource_type_id_idx" ON "assets"("resource_type_id");
CREATE INDEX "worker_competencies_competency_id_idx" ON "worker_competencies"("competency_id");
CREATE INDEX "lookup_values_category_is_active_idx" ON "lookup_values"("category", "is_active");

ALTER TABLE "contacts" ADD CONSTRAINT "contacts_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sites" ADD CONSTRAINT "sites_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "workers" ADD CONSTRAINT "workers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "workers" ADD CONSTRAINT "workers_resource_type_id_fkey" FOREIGN KEY ("resource_type_id") REFERENCES "resource_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "crew_workers" ADD CONSTRAINT "crew_workers_crew_id_fkey" FOREIGN KEY ("crew_id") REFERENCES "crews"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "crew_workers" ADD CONSTRAINT "crew_workers_worker_id_fkey" FOREIGN KEY ("worker_id") REFERENCES "workers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "assets" ADD CONSTRAINT "assets_resource_type_id_fkey" FOREIGN KEY ("resource_type_id") REFERENCES "resource_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "worker_competencies" ADD CONSTRAINT "worker_competencies_worker_id_fkey" FOREIGN KEY ("worker_id") REFERENCES "workers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "worker_competencies" ADD CONSTRAINT "worker_competencies_competency_id_fkey" FOREIGN KEY ("competency_id") REFERENCES "competencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
