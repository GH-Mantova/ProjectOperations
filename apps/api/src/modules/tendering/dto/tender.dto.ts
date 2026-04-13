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

export class CreateTenderNoteDto {
  @IsString()
  body!: string;
}

export class CreateTenderClarificationDto {
  @IsString()
  subject!: string;
  @IsOptional() @IsString() response?: string;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsDateString() dueDate?: string;
}

export class CreateTenderFollowUpDto {
  @IsDateString()
  dueAt!: string;
  @IsString()
  details!: string;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() assignedUserId?: string;
}

export class PreviewTenderImportDto {
  @IsString()
  csvText!: string;
}

export class UpsertTenderDto {
  @IsString()
  tenderNumber!: string;
  @IsString()
  title!: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() estimatorUserId?: string;
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
