import { Type } from "class-transformer";
import { IsBoolean, IsDateString, IsInt, IsOptional, IsString } from "class-validator";
import { PaginationQueryDto } from "../../../common/dto/pagination-query.dto";

export class MaintenanceQueryDto extends PaginationQueryDto {
  @IsOptional() @IsString() assetId?: string;
  @IsOptional() @IsString() status?: string;
}

export class UpsertMaintenancePlanDto {
  @IsString() assetId!: string;
  @IsString() title!: string;
  @IsOptional() @IsString() description?: string;
  @Type(() => Number) @IsInt() intervalDays!: number;
  @IsOptional() @Type(() => Number) @IsInt() warningDays?: number;
  @IsOptional() @Type(() => Boolean) @IsBoolean() blockWhenOverdue?: boolean;
  @IsOptional() @IsDateString() lastCompletedAt?: string;
  @IsOptional() @IsDateString() nextDueAt?: string;
  @IsOptional() @IsString() status?: string;
}

export class UpsertMaintenanceEventDto {
  @IsString() assetId!: string;
  @IsOptional() @IsString() maintenancePlanId?: string;
  @IsString() eventType!: string;
  @IsOptional() @IsDateString() scheduledAt?: string;
  @IsOptional() @IsDateString() completedAt?: string;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() notes?: string;
}

export class UpsertInspectionDto {
  @IsString() assetId!: string;
  @IsString() inspectionType!: string;
  @IsDateString() inspectedAt!: string;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() notes?: string;
}

export class UpsertBreakdownDto {
  @IsString() assetId!: string;
  @IsDateString() reportedAt!: string;
  @IsOptional() @IsDateString() resolvedAt?: string;
  @IsOptional() @IsString() severity?: string;
  @IsOptional() @IsString() status?: string;
  @IsString() summary!: string;
  @IsOptional() @IsString() notes?: string;
}

export class UpdateAssetStatusDto {
  @IsString() status!: string;
  @IsOptional() @IsString() note?: string;
}
