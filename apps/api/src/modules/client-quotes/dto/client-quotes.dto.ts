import { Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested
} from "class-validator";
import { ClientQuoteStatus } from "@prisma/client";

export class CreateClientQuoteDto {
  @IsString() clientId!: string;
  @IsOptional() @IsString() copyFromQuoteId?: string;
}

export class UpdateClientQuoteDto {
  @IsOptional() @IsNumber() adjustmentPct?: number | null;
  @IsOptional() @IsNumber() adjustmentAmt?: number | null;
  @IsOptional() @IsString() adjustmentNote?: string | null;
  @IsOptional() @IsString() assumptionMode?: "free" | "linked";
  @IsOptional() @IsBoolean() showProvisional?: boolean;
  @IsOptional() @IsBoolean() showCostOptions?: boolean;
  @IsOptional() @IsBoolean() showScopeTable?: boolean;
  @IsOptional() @IsBoolean() showAssumptions?: boolean;
  @IsOptional() @IsBoolean() showExclusions?: boolean;
  @IsOptional() @IsBoolean() showReferencedDrawings?: boolean;
  @IsOptional() @IsEnum(ClientQuoteStatus) status?: ClientQuoteStatus;
  @IsOptional() @IsString() detailLevel?: "simple" | "detailed";
}

export class UpsertCostLineDto {
  @IsString() label!: string;
  @IsString() description!: string;
  @IsNumber() price!: number;
  @IsOptional() @IsBoolean() isVisible?: boolean;
  @IsOptional() @Type(() => Number) @IsInt() sortOrder?: number;
}

export class UpsertProvisionalLineDto {
  @IsString() description!: string;
  @IsNumber() price!: number;
  @IsOptional() @IsString() notes?: string | null;
  @IsOptional() @Type(() => Number) @IsInt() sortOrder?: number;
}

export class UpsertCostOptionDto {
  @IsString() label!: string;
  @IsString() description!: string;
  @IsNumber() price!: number;
  @IsOptional() @IsString() notes?: string | null;
  @IsOptional() @Type(() => Number) @IsInt() sortOrder?: number;
}

export class UpsertAssumptionDto {
  @IsString() text!: string;
  @IsOptional() @IsString() costLineId?: string | null;
  @IsOptional() @Type(() => Number) @IsInt() sortOrder?: number;
}

export class UpsertExclusionDto {
  @IsString() text!: string;
  @IsOptional() @Type(() => Number) @IsInt() sortOrder?: number;
}

class ReorderEntry {
  @IsString() lineId!: string;
  @Type(() => Number) @IsInt() sortOrder!: number;
}
export class ReorderDto {
  @IsArray() @ValidateNested({ each: true }) @Type(() => ReorderEntry) order!: ReorderEntry[];
}

export class SendQuoteDto {
  @IsArray() @IsString({ each: true }) to!: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) cc?: string[];
  @IsString() subject!: string;
  @IsString() body!: string;
  @IsBoolean() attachPdf!: boolean;
}
