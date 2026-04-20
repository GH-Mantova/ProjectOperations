import { Type } from "class-transformer";
import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsNumberString,
  IsOptional,
  IsString,
  Min
} from "class-validator";

// Rate library DTOs
export class UpsertLabourRateDto {
  @IsString() role!: string;
  @IsNumberString() dayRate!: string;
  @IsNumberString() nightRate!: string;
  @IsNumberString() weekendRate!: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @Type(() => Number) @IsInt() sortOrder?: number;
}

export class UpsertPlantRateDto {
  @IsString() item!: string;
  @IsOptional() @IsString() unit?: string;
  @IsNumberString() rate!: string;
  @IsOptional() @IsNumberString() fuelRate?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @Type(() => Number) @IsInt() sortOrder?: number;
}

export class UpsertWasteRateDto {
  @IsString() wasteType!: string;
  @IsString() facility!: string;
  @IsNumberString() tonRate!: string;
  @IsOptional() @IsNumberString() loadRate?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @Type(() => Number) @IsInt() sortOrder?: number;
}

export class UpsertCuttingRateDto {
  @IsString() cuttingType!: string;
  @IsString() unit!: string;
  @IsNumberString() rate!: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @Type(() => Number) @IsInt() sortOrder?: number;
}

// Estimate & item DTOs
export class UpdateEstimateDto {
  @IsOptional() @IsNumberString() markup?: string;
  @IsOptional() @IsString() notes?: string;
}

export class UpsertEstimateItemDto {
  @IsString() code!: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) itemNumber?: number;
  @IsString() title!: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsNumberString() markup?: string;
  @IsOptional() @IsBoolean() isProvisional?: boolean;
  @IsOptional() @IsNumberString() provisionalAmount?: string;
  @IsOptional() @Type(() => Number) @IsInt() sortOrder?: number;
}

export class UpdateEstimateItemDto {
  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsNumberString() markup?: string;
  @IsOptional() @IsBoolean() isProvisional?: boolean;
  @IsOptional() @IsNumberString() provisionalAmount?: string;
  @IsOptional() @Type(() => Number) @IsInt() sortOrder?: number;
}

// Line DTOs
export class UpsertLabourLineDto {
  @IsString() role!: string;
  @IsNumberString() qty!: string;
  @IsNumberString() days!: string;
  @IsOptional() @IsString() shift?: string;
  @IsNumberString() rate!: string;
  @IsOptional() @Type(() => Number) @IsInt() sortOrder?: number;
}

export class UpsertPlantLineDto {
  @IsString() plantItem!: string;
  @IsNumberString() qty!: string;
  @IsNumberString() days!: string;
  @IsOptional() @IsString() comment?: string;
  @IsNumberString() rate!: string;
  @IsOptional() @Type(() => Number) @IsInt() sortOrder?: number;
}

export class UpsertWasteLineDto {
  @IsOptional() @IsString() wasteGroup?: string;
  @IsString() wasteType!: string;
  @IsString() facility!: string;
  @IsNumberString() qtyTonnes!: string;
  @IsNumberString() tonRate!: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) loads?: number;
  @IsOptional() @IsNumberString() loadRate?: string;
  @IsOptional() @Type(() => Number) @IsInt() sortOrder?: number;
}

export class UpsertCuttingLineDto {
  @IsString() cuttingType!: string;
  @IsNumberString() qty!: string;
  @IsString() unit!: string;
  @IsOptional() @IsString() comment?: string;
  @IsNumberString() rate!: string;
  @IsOptional() @Type(() => Number) @IsInt() sortOrder?: number;
}

export class UpsertAssumptionDto {
  @IsString() text!: string;
  @IsOptional() @Type(() => Number) @IsInt() sortOrder?: number;
}

// Line update (all fields optional)
export class UpdateLabourLineDto {
  @IsOptional() @IsString() role?: string;
  @IsOptional() @IsNumberString() qty?: string;
  @IsOptional() @IsNumberString() days?: string;
  @IsOptional() @IsString() shift?: string;
  @IsOptional() @IsNumberString() rate?: string;
  @IsOptional() @Type(() => Number) @IsInt() sortOrder?: number;
}

export class UpdatePlantLineDto {
  @IsOptional() @IsString() plantItem?: string;
  @IsOptional() @IsNumberString() qty?: string;
  @IsOptional() @IsNumberString() days?: string;
  @IsOptional() @IsString() comment?: string;
  @IsOptional() @IsNumberString() rate?: string;
  @IsOptional() @Type(() => Number) @IsInt() sortOrder?: number;
}

export class UpdateWasteLineDto {
  @IsOptional() @IsString() wasteGroup?: string;
  @IsOptional() @IsString() wasteType?: string;
  @IsOptional() @IsString() facility?: string;
  @IsOptional() @IsNumberString() qtyTonnes?: string;
  @IsOptional() @IsNumberString() tonRate?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) loads?: number;
  @IsOptional() @IsNumberString() loadRate?: string;
  @IsOptional() @Type(() => Number) @IsInt() sortOrder?: number;
}

export class UpdateCuttingLineDto {
  @IsOptional() @IsString() cuttingType?: string;
  @IsOptional() @IsNumberString() qty?: string;
  @IsOptional() @IsString() unit?: string;
  @IsOptional() @IsString() comment?: string;
  @IsOptional() @IsNumberString() rate?: string;
  @IsOptional() @Type(() => Number) @IsInt() sortOrder?: number;
}

export class UpdateAssumptionDto {
  @IsOptional() @IsString() text?: string;
  @IsOptional() @Type(() => Number) @IsInt() sortOrder?: number;
}
