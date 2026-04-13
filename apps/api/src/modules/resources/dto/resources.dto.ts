import { Type } from "class-transformer";
import { IsDateString, IsInt, IsOptional, IsString } from "class-validator";
import { PaginationQueryDto } from "../../../common/dto/pagination-query.dto";

export class ResourcesQueryDto extends PaginationQueryDto {
  @IsOptional() @IsString() q?: string;
  @IsOptional() @IsString() competencyId?: string;
}

export class UpsertAvailabilityWindowDto {
  @IsString() workerId!: string;
  @IsDateString() startAt!: string;
  @IsDateString() endAt!: string;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() notes?: string;
}

export class UpsertWorkerRoleSuitabilityDto {
  @IsString() workerId!: string;
  @IsString() roleLabel!: string;
  @IsOptional() @IsString() suitability?: string;
  @IsOptional() @IsString() notes?: string;
}

export class UpsertShiftRoleRequirementDto {
  @IsString() roleLabel!: string;
  @IsOptional() @IsString() competencyId?: string;
  @IsOptional() @Type(() => Number) @IsInt() requiredCount?: number;
}
