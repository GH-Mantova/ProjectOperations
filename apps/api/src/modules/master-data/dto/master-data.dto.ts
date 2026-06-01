import { ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min
} from "class-validator";
import { Type } from "class-transformer";
import { PAYMENT_TERMS_TYPES, PaymentTermsType } from "../payment-terms.const";

/**
 * Payload for creating or updating a Client. Used by both `POST /master-data/clients`
 * (create) and `PATCH /master-data/clients/:id` (update) — all fields except `name`
 * are optional so PATCH callers can send only the keys they want to change.
 *
 * Includes the business directory fields (PR #73) and the Xero alignment fields
 * (PR-40), notably the `paymentTermsDay` / `paymentTermsType` pair which the
 * service layer enforces must be set together.
 */
export class UpsertClientDto {
  @IsString()
  name!: string;
  @IsOptional() @IsString() code?: string;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() email?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsInt() @Min(1) @Max(28) claimCutoffDay?: number | null;
  @IsOptional() @IsString() claimReminderUserId?: string | null;
  @IsOptional() @IsInt() @Min(1) @Max(5) preferenceScore?: number | null;
  // Business directory (PR #73)
  @IsOptional() @IsString() tradingName?: string | null;
  @IsOptional() @IsString() businessType?: string;
  @IsOptional() @IsString() abn?: string | null;
  @IsOptional() @IsString() acn?: string | null;
  @IsOptional() @IsBoolean() gstRegistered?: boolean;
  @IsOptional() @IsString() industry?: string | null;
  @IsOptional() @IsString() website?: string | null;
  @IsOptional() @IsString() physicalAddress?: string | null;
  @IsOptional() @IsString() physicalSuburb?: string | null;
  @IsOptional() @IsString() physicalState?: string | null;
  @IsOptional() @IsString() physicalPostcode?: string | null;
  @IsOptional() @IsString() postalAddress?: string | null;
  @IsOptional() @IsString() postalSuburb?: string | null;
  @IsOptional() @IsString() postalState?: string | null;
  @IsOptional() @IsString() postalPostcode?: string | null;
  @IsOptional() @IsBoolean() postalSameAs?: boolean;
  @IsOptional() @Type(() => Number) @IsInt() paymentTermsDays?: number | null;
  @IsOptional() @Type(() => Number) @IsNumber() creditLimit?: number | null;
  @IsOptional() @IsBoolean() creditApproved?: boolean;
  @IsOptional() @IsString() preferredPayment?: string | null;
  @IsOptional() @IsString() bankName?: string | null;
  @IsOptional() @IsString() bankAccountName?: string | null;
  @IsOptional() @IsString() bankBsb?: string | null;
  @IsOptional() @IsString() bankAccountNumber?: string | null;
  @IsOptional() @IsString() xeroContactId?: string | null;
  @IsOptional() @IsString() myobCardId?: string | null;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsBoolean() onHold?: boolean;
  @IsOptional() @IsString() onHoldReason?: string | null;
  @IsOptional() @IsString() internalNotes?: string | null;

  // Xero alignment (PR-40)
  @ApiPropertyOptional({ description: "Legal entity name as it appears on contracts/invoices (distinct from display `name` and `tradingName`)." })
  @IsOptional() @IsString() legalName?: string | null;

  @ApiPropertyOptional({ description: "Country of the organisation. Defaults to 'Australia'." })
  @IsOptional() @IsString() country?: string;

  @ApiPropertyOptional({ description: "Day-of-month component of the Xero payment-terms pair (1–31). Must be supplied with `paymentTermsType`." })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(31) paymentTermsDay?: number | null;

  @ApiPropertyOptional({ enum: PAYMENT_TERMS_TYPES, description: "Vocabulary that mirrors Xero's contact payment-terms. Must be supplied with `paymentTermsDay`." })
  @IsOptional() @IsIn(PAYMENT_TERMS_TYPES as unknown as string[]) paymentTermsType?: PaymentTermsType | null;
}

/**
 * Payload for creating or updating a Contact attached to a Client.
 *
 * Contact is a polymorphic table (organisationType + organisationId) and this
 * DTO only covers CLIENT-owned contacts — `clientId` is required on create and
 * maps to the polymorphic organisation id on the row.
 */
export class UpsertContactDto {
  /** Owning client id; required on create, ignored on update. */
  @IsString()
  clientId!: string;
  @IsString()
  firstName!: string;
  @IsString()
  lastName!: string;
  @IsOptional() @IsString() email?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() mobile?: string;
  /** @deprecated — use `role` instead. Retained for backward compat with existing callers. */
  @IsOptional() @IsString() position?: string;
  @IsOptional() @IsString() role?: string;
  @IsOptional() @IsBoolean() isPrimary?: boolean;
  @IsOptional() @IsBoolean() hasPortalAccess?: boolean;
  @IsOptional() @IsBoolean() isAccountsContact?: boolean;
  @IsOptional() @IsString() notes?: string;

  @ApiPropertyOptional({ description: "CC this contact on invoice/quote emails sent to their organisation." })
  @IsOptional() @IsBoolean() includeInInvoiceEmails?: boolean;
}

/**
 * Payload for creating or updating a Site — the physical work location used by
 * tenders, projects, and scheduling. `name` is enforced unique at the service layer.
 */
export class UpsertSiteDto {
  @IsString()
  name!: string;
  @IsOptional() @IsString() clientId?: string;
  @IsOptional() @IsString() code?: string;
  @IsOptional() @IsString() addressLine1?: string;
  @IsOptional() @IsString() suburb?: string;
  @IsOptional() @IsString() state?: string;
  @IsOptional() @IsString() postcode?: string;
  @IsOptional() @IsString() notes?: string;
}

/**
 * Payload for creating or updating a ResourceType — the lookup that classifies
 * workers and assets into categories (operator, labourer, excavator, etc.).
 */
export class UpsertResourceTypeDto {
  @IsString()
  name!: string;
  @IsString()
  category!: string;
  @IsOptional() @IsString() code?: string;
  @IsOptional() @IsString() description?: string;
}

/**
 * Payload for creating or updating a Competency — a named qualification a
 * worker may hold (e.g. white card, confined-space entry). Workers are linked
 * to competencies via the WorkerCompetency join.
 */
export class UpsertCompetencyDto {
  @IsString()
  name!: string;
  @IsOptional() @IsString() code?: string;
  @IsOptional() @IsString() description?: string;
}

/**
 * Payload for creating or updating a Worker — the person record used by
 * scheduling, timesheets, and competency tracking. Optionally links to a User
 * (`userId`) for workers who log into the portal.
 */
export class UpsertWorkerDto {
  @IsString()
  firstName!: string;
  @IsString()
  lastName!: string;
  @IsOptional() @IsString() userId?: string;
  @IsOptional() @IsString() resourceTypeId?: string;
  @IsOptional() @IsString() employeeCode?: string;
  @IsOptional() @IsString() email?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() employmentType?: string;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() notes?: string;
}

/**
 * Payload for creating or updating a Crew — a named group of workers that can
 * be scheduled as a unit.
 *
 * `workerIds` is treated as the canonical membership list: when supplied, the
 * service replaces existing `CrewWorker` rows wholesale, so omit the field to
 * leave membership untouched and pass `[]` to remove every member.
 */
export class UpsertCrewDto {
  @IsString()
  name!: string;
  @IsOptional() @IsString() code?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() status?: string;
  /** Canonical worker membership list; omitting leaves members untouched, `[]` removes all. */
  @IsOptional() @IsArray() workerIds?: string[];
}

/**
 * Payload for creating or updating an Asset — equipment or vehicles owned by
 * the company. `assetCode` is the human-friendly identifier shown on
 * scheduling boards and maintenance forms.
 */
export class UpsertAssetDto {
  @IsString()
  name!: string;
  @IsString()
  assetCode!: string;
  @IsOptional() @IsString() resourceTypeId?: string;
  @IsOptional() @IsString() serialNumber?: string;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() homeBase?: string;
  @IsOptional() @IsString() notes?: string;
}

/**
 * Payload for assigning a Competency to a Worker (or updating an existing assignment).
 *
 * Dates arrive as ISO date strings and are coerced to `Date` by the service so
 * the underlying Prisma timestamp columns receive the correct type.
 */
export class UpsertWorkerCompetencyDto {
  @IsString()
  workerId!: string;
  @IsString()
  competencyId!: string;
  /** Date the worker achieved this competency (ISO 8601). */
  @IsOptional() @IsDateString() achievedAt?: string;
  /** Date this competency expires (ISO 8601); omit for non-expiring competencies. */
  @IsOptional() @IsDateString() expiresAt?: string;
  @IsOptional() @IsString() notes?: string;
}

/**
 * Payload for creating or updating a LookupValue — a generic
 * `category` → `key` → `value` row used to back configurable dropdowns and
 * enum-like fields across the platform without schema changes.
 */
export class UpsertLookupValueDto {
  @IsString()
  category!: string;
  @IsString()
  key!: string;
  @IsString()
  value!: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
