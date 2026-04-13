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
  @IsString()
  jobNumber!: string;

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
}

export class RollbackTenderLifecycleDto {
  @IsString()
  @IsIn(["DRAFT", "IN_PROGRESS", "SUBMITTED", "AWARDED", "CONTRACT_ISSUED"])
  targetStage!: "DRAFT" | "IN_PROGRESS" | "SUBMITTED" | "AWARDED" | "CONTRACT_ISSUED";

  @IsOptional()
  @IsString()
  tenderClientId?: string;
}
