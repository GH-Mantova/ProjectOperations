import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { PaginationQueryDto } from "../../../common/dto/pagination-query.dto";

/**
 * Prisma-mirrored enums exposed to the DTO layer so `class-validator` can
 * gate incoming payloads without pulling `@prisma/client` into request-side
 * metadata.
 */
export enum ProcurementLineCategoryDto {
  CONSUMABLE = "CONSUMABLE",
  EQUIPMENT = "EQUIPMENT",
  HIRE = "HIRE",
  ASSET = "ASSET",
  SUBCONTRACT = "SUBCONTRACT"
}

export enum ProcurementRequestStatusDto {
  DRAFT = "DRAFT",
  SUBMITTED = "SUBMITTED",
  APPROVED = "APPROVED",
  ISSUED = "ISSUED",
  RECEIVED = "RECEIVED",
  CANCELLED = "CANCELLED"
}

/** Single line inside a procurement request. */
export class ProcurementLineInputDto {
  @ApiProperty() @IsString() description!: string;
  @ApiProperty({ enum: ProcurementLineCategoryDto })
  @IsEnum(ProcurementLineCategoryDto)
  category!: ProcurementLineCategoryDto;
  @ApiPropertyOptional() @IsOptional() @IsString() stockItemId?: string;
  @ApiProperty() @Type(() => Number) @IsNumber() quantity!: number;
  @ApiProperty() @IsString() unit!: string;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber() unitPrice?: number;
}

/** Payload to create a DRAFT procurement request. */
export class CreateProcurementRequestDto {
  @ApiPropertyOptional() @IsOptional() @IsString() originDepartment?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() jobId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() supplierId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
  @ApiProperty({ type: [ProcurementLineInputDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ProcurementLineInputDto)
  lines!: ProcurementLineInputDto[];
}

/** Payload to edit a DRAFT procurement request. Lines, when supplied, replace the current set. */
export class UpdateProcurementRequestDto {
  @ApiPropertyOptional() @IsOptional() @IsString() originDepartment?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() jobId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() supplierId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
  @ApiPropertyOptional({ type: [ProcurementLineInputDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProcurementLineInputDto)
  lines?: ProcurementLineInputDto[];
}

/**
 * Submit a DRAFT for approval routing. `quoteEvidenceRef` is the document
 * reference — a folder link, quote number, or attachment id — proving the
 * value-band sourcing requirement was satisfied (POL 1.2.14).
 */
export class SubmitProcurementRequestDto {
  @ApiPropertyOptional() @IsOptional() @IsString() quoteEvidenceRef?: string;
}

/** Issue a PO / subcontract for an APPROVED request. Supplier is already on the request. */
export class IssuePurchaseOrderDto {
  @ApiPropertyOptional() @IsOptional() @IsString() documentRef?: string;
}

/** Query envelope for /procurement/requests list. */
export class ListProcurementRequestsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: ProcurementRequestStatusDto })
  @IsOptional()
  @IsEnum(ProcurementRequestStatusDto)
  status?: ProcurementRequestStatusDto;
}
