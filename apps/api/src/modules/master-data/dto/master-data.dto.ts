import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min
} from "class-validator";
import { Type } from "class-transformer";

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
}

export class UpsertContactDto {
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
}

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

export class UpsertResourceTypeDto {
  @IsString()
  name!: string;
  @IsString()
  category!: string;
  @IsOptional() @IsString() code?: string;
  @IsOptional() @IsString() description?: string;
}

export class UpsertCompetencyDto {
  @IsString()
  name!: string;
  @IsOptional() @IsString() code?: string;
  @IsOptional() @IsString() description?: string;
}

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

export class UpsertCrewDto {
  @IsString()
  name!: string;
  @IsOptional() @IsString() code?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsArray() workerIds?: string[];
}

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

export class UpsertWorkerCompetencyDto {
  @IsString()
  workerId!: string;
  @IsString()
  competencyId!: string;
  @IsOptional() @IsDateString() achievedAt?: string;
  @IsOptional() @IsDateString() expiresAt?: string;
  @IsOptional() @IsString() notes?: string;
}

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
