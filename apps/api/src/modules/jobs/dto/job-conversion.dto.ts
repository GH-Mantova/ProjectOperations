import { Type } from "class-transformer";
import { IsArray, IsBoolean, IsDateString, IsIn, IsOptional, IsString } from "class-validator";

export class AwardTenderClientDto {
  @IsString()
  tenderClientId!: string;
}

export class IssueTenderContractDto {
  @IsString()
  tenderClientId!: string;

  @IsOptional()
  @IsDateString()
  contractIssuedAt?: string;
}

export class ConvertTenderToJobDto {
  // PR B05 — canonical J-YYYY-NNN. Omit to let the server generate one
  // via JobNumberService; when supplied, validated against the canonical
  // regex. Legacy JOB-YYYY-NNN inputs are rejected with 400.
  @IsOptional()
  @IsString()
  jobNumber?: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  siteId?: string;

  @IsOptional()
  @IsString()
  projectManagerId?: string;

  @IsOptional()
  @IsString()
  supervisorId?: string;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  carryTenderDocuments?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tenderDocumentIds?: string[];
}

export class ReuseArchivedJobConversionDto extends ConvertTenderToJobDto {
  @IsOptional()
  @IsString()
  archivedJobId?: string;

  @IsString()
  stageName!: string;

  // PR B05 — reuseArchived needs to look the archived job up by number
  // when archivedJobId isn't supplied, so jobNumber stays required on
  // this DTO. `declare` keeps TS happy about overriding the now-optional
  // parent decoration without re-emitting a duplicate field.
  @IsString()
  declare jobNumber: string;
}

export class RollbackTenderLifecycleDto {
  @IsString()
  @IsIn(["DRAFT", "IN_PROGRESS", "SUBMITTED", "AWARDED", "CONTRACT_ISSUED"])
  targetStage!: "DRAFT" | "IN_PROGRESS" | "SUBMITTED" | "AWARDED" | "CONTRACT_ISSUED";

  @IsOptional()
  @IsString()
  tenderClientId?: string;
}
