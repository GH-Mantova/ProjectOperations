import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Max,
  MaxLength,
  Min
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";

export enum ExpenseStatusDto {
  DRAFT = "DRAFT",
  SUBMITTED = "SUBMITTED",
  APPROVED = "APPROVED",
  REJECTED = "REJECTED",
  REIMBURSED = "REIMBURSED"
}

export enum ExpensePaymentMethodDto {
  CARD = "CARD",
  CASH = "CASH",
  PERSONAL_REIMBURSABLE = "PERSONAL_REIMBURSABLE"
}

export class CreateExpenseDto {
  @ApiPropertyOptional({ description: "Project ID for cost allocation" })
  @IsOptional()
  @IsString()
  projectId?: string;

  @ApiPropertyOptional({ description: "Job ID for cost allocation" })
  @IsOptional()
  @IsString()
  jobId?: string;

  @ApiProperty({ description: "Category value bound to the expense-categories GlobalList" })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  category!: string;

  @ApiProperty({ description: "Description of the expense" })
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  description!: string;

  @ApiProperty({ description: "Date the expense was incurred (ISO 8601 date)" })
  @IsDateString()
  spentOn!: string;

  @ApiProperty({ description: "Amount (ex GST) in AUD", type: Number })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @Max(9999999.99)
  amount!: number;

  @ApiPropertyOptional({ description: "GST component in AUD", type: Number })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(9999999.99)
  gst?: number;

  @ApiPropertyOptional({
    description: "Payment method",
    enum: ExpensePaymentMethodDto
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  paymentMethod?: string;

  @ApiPropertyOptional({ description: "DocumentLink ID of the attached receipt" })
  @IsOptional()
  @IsString()
  receiptDocumentId?: string;

  @ApiPropertyOptional({ description: "Internal notes" })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

export class UpdateExpenseDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  projectId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  jobId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  category?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  spentOn?: string;

  @ApiPropertyOptional({ type: Number })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @Max(9999999.99)
  amount?: number;

  @ApiPropertyOptional({ type: Number })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(9999999.99)
  gst?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  paymentMethod?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  receiptDocumentId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

export class RejectExpenseDto {
  @ApiProperty({ description: "Reason for rejecting the expense claim" })
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  rejectionReason!: string;
}

export class ListExpensesQueryDto {
  @ApiPropertyOptional({ enum: ExpenseStatusDto })
  @IsOptional()
  @IsEnum(ExpenseStatusDto)
  status?: ExpenseStatusDto;

  @ApiPropertyOptional({ description: "Filter by submitter user ID" })
  @IsOptional()
  @IsString()
  submittedById?: string;

  @ApiPropertyOptional({ description: "Filter by project ID" })
  @IsOptional()
  @IsString()
  projectId?: string;

  @ApiPropertyOptional({ description: "Filter by job ID" })
  @IsOptional()
  @IsString()
  jobId?: string;

  @ApiPropertyOptional({ type: Number, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ type: Number, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  pageSize: number = 20;
}
