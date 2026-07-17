import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsInt,
  IsNumberString,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested
} from "class-validator";
import { Type } from "class-transformer";

class TenderClientInputDto {
  @IsString()
  clientId!: string;
  @IsOptional() @IsString() contactId?: string;
  @IsOptional() @IsBoolean() isAwarded?: boolean;
  @IsOptional() @IsString() relationshipType?: string;
  @IsOptional() @IsString() notes?: string;
}

class TenderNoteInputDto {
  @IsString()
  body!: string;
}

class TenderClarificationInputDto {
  @IsString()
  subject!: string;
  @IsOptional() @IsString() response?: string;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsDateString() dueDate?: string;
}

class TenderPricingSnapshotInputDto {
  @IsString()
  versionLabel!: string;
  @IsOptional() @IsNumberString() estimatedValue?: string;
  @IsOptional() @IsNumberString() marginPercent?: string;
  @IsOptional() @IsString() assumptions?: string;
}

class TenderFollowUpInputDto {
  @IsDateString()
  dueAt!: string;
  @IsString()
  details!: string;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() assignedUserId?: string;
}

/** Body for creating a unified tender activity entry. */
export class CreateTenderActivityDto {
  @IsString()
  activityType!: string;

  @IsString()
  title!: string;

  @IsOptional() @IsString() details?: string;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsDateString() dueAt?: string;
  @IsOptional() @IsString() assignedUserId?: string;
}

/** Partial-update body for a unified tender activity entry. */
export class UpdateTenderActivityDto {
  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsString() details?: string;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsDateString() dueAt?: string;
  @IsOptional() @IsString() assignedUserId?: string;
}

class TenderOutcomeInputDto {
  @IsString()
  outcomeType!: string;
  @IsOptional() @IsString() notes?: string;
}

/** Body for the legacy tender-note write endpoint. */
export class CreateTenderNoteDto {
  @IsString()
  body!: string;
}

/** Body for the legacy tender-clarification write endpoint. */
export class CreateTenderClarificationDto {
  @IsString()
  subject!: string;
  @IsOptional() @IsString() response?: string;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsDateString() dueDate?: string;
}

/** Body for the legacy tender follow-up write endpoint. */
export class CreateTenderFollowUpDto {
  @IsDateString()
  dueAt!: string;
  @IsString()
  details!: string;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() assignedUserId?: string;
}

/** Body for the tender CSV import preview / commit endpoints. */
export class PreviewTenderImportDto {
  @IsString()
  csvText!: string;
}

/** Full tender create/update payload with nested collections. */
export class UpsertTenderDto {
  /**
   * G5 — tender numbers are server-generated (T{YYMMDD}-{SLUG}-Rev{N}).
   * Ignored on create/update; only the CSV import path persists a supplied
   * value (historical register numbers).
   */
  @IsOptional() @IsString() tenderNumber?: string;
  @IsString()
  title!: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() estimatorUserId?: string;
  // Site is captured at wizard time (Geoapify autocomplete) and required
  // going forward. Legacy tenders were backfilled to the "Unassigned" Site
  // by the 20260717120000_tender_siteid_not_null migration.
  @IsString() siteId!: string;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsDateString() dueDate?: string;
  @IsOptional() @IsDateString() proposedStartDate?: string;
  @IsOptional() @IsInt() leadTimeDays?: number;
  @IsOptional() @IsInt() @Min(0) @Max(100) probability?: number;
  @IsOptional() @IsNumberString() estimatedValue?: string;
  @IsOptional() @IsString() notes?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TenderClientInputDto)
  tenderClients?: TenderClientInputDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TenderNoteInputDto)
  tenderNotes?: TenderNoteInputDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TenderClarificationInputDto)
  clarifications?: TenderClarificationInputDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TenderPricingSnapshotInputDto)
  pricingSnapshots?: TenderPricingSnapshotInputDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TenderFollowUpInputDto)
  followUps?: TenderFollowUpInputDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TenderOutcomeInputDto)
  outcomes?: TenderOutcomeInputDto[];
}
