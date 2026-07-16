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
 * DTO-layer enums for Commitment models — mirrors Prisma enums without
 * importing @prisma/client in request-handling metadata.
 */
export enum CommitmentTypeDto {
  SUBCONTRACT = "SUBCONTRACT",
  PURCHASE_ORDER = "PURCHASE_ORDER",
  HIRE = "HIRE",
  OTHER = "OTHER"
}

export enum CommitmentStatusDto {
  DRAFT = "DRAFT",
  APPROVED = "APPROVED",
  CLOSED = "CLOSED",
  CANCELLED = "CANCELLED"
}

export enum CommitmentChangeStatusDto {
  DRAFT = "DRAFT",
  PENDING = "PENDING",
  APPROVED = "APPROVED",
  REJECTED = "REJECTED"
}

/** A single cost line within a commitment. */
export class CommitmentItemInputDto {
  @ApiProperty() @IsString() description!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() costCategory?: string;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber() quantity?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() unit?: string;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber() rate?: number;
  @ApiProperty() @Type(() => Number) @IsNumber() amount!: number;
}

/** Create a new Commitment on a job. */
export class CreateCommitmentDto {
  @ApiProperty() @IsString() jobId!: string;
  @ApiProperty({ enum: CommitmentTypeDto })
  @IsEnum(CommitmentTypeDto)
  type!: CommitmentTypeDto;
  @ApiPropertyOptional() @IsOptional() @IsString() supplierId?: string;
  @ApiProperty() @IsString() reference!: string;
  @ApiProperty() @IsString() description!: string;
  @ApiProperty() @Type(() => Number) @IsNumber() value!: number;
  @ApiPropertyOptional() @IsOptional() @IsString() purchaseOrderId?: string;
  @ApiPropertyOptional({ type: [CommitmentItemInputDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CommitmentItemInputDto)
  items?: CommitmentItemInputDto[];
}

/** Edit an existing Commitment (status transitions use dedicated endpoints). */
export class UpdateCommitmentDto {
  @ApiPropertyOptional({ enum: CommitmentTypeDto })
  @IsOptional()
  @IsEnum(CommitmentTypeDto)
  type?: CommitmentTypeDto;
  @ApiPropertyOptional() @IsOptional() @IsString() supplierId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() reference?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber() value?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() purchaseOrderId?: string;
  @ApiPropertyOptional({ type: [CommitmentItemInputDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CommitmentItemInputDto)
  items?: CommitmentItemInputDto[];
}

/** Query envelope for commitment list — filter by jobId and/or status. */
export class ListCommitmentsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsString() jobId?: string;
  @ApiPropertyOptional({ enum: CommitmentStatusDto })
  @IsOptional()
  @IsEnum(CommitmentStatusDto)
  status?: CommitmentStatusDto;
}

/** Variation / scope change applied to a committed value. */
export class CreateCommitmentChangeDto {
  @ApiProperty() @IsString() reference!: string;
  @ApiProperty() @IsString() description!: string;
  /** Positive = increase, negative = decrease in contract value. */
  @ApiProperty() @Type(() => Number) @IsNumber() valueChange!: number;
}

/** Query envelope for commitment budget summary by job. */
export class JobBudgetSummaryQueryDto {
  @ApiProperty() @IsString() jobId!: string;
}
