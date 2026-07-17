import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { PaginationQueryDto } from "../../../common/dto/pagination-query.dto";

/**
 * DTO-layer mirror of the InvoiceMatchStatus Prisma enum so class-validator
 * can gate incoming payloads without pulling @prisma/client into request
 * metadata.
 */
export enum InvoiceMatchStatusDto {
  PENDING = "PENDING",
  MATCHED = "MATCHED",
  HELD = "HELD",
  APPROVED = "APPROVED",
  REJECTED = "REJECTED"
}

/**
 * A single billed line inside a CreateVendorInvoiceDto.
 *
 * orderedQty / orderedUnitPrice are the PO figures from the matched
 * ProcurementLine (the caller supplies them so the three-way record is
 * self-contained and survives future PO edits). receivedQty is the goods-
 * receipt quantity (currently the ProcurementLine.quantity as at RECEIVED
 * status; a future GoodsReceipt model can refine this).
 */
export class VendorInvoiceLineInputDto {
  @ApiPropertyOptional({
    description: "Procurement line id this invoice line is matched against (omit for extra charges)"
  })
  @IsOptional()
  @IsString()
  procurementLineId?: string;

  @ApiProperty({ description: "Line description as it appears on the supplier invoice" })
  @IsString()
  description!: string;

  @ApiPropertyOptional({ description: "Ordered quantity from the PO line (for variance calc)" })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  orderedQty?: number;

  @ApiPropertyOptional({ description: "Received quantity from the goods receipt (for variance calc)" })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  receivedQty?: number;

  @ApiProperty({ description: "Quantity billed by the supplier on this line" })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  billedQty!: number;

  @ApiPropertyOptional({ description: "Unit price from the PO line (for price-variance calc)" })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  orderedUnitPrice?: number;

  @ApiProperty({ description: "Unit price charged by the supplier on this line" })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  billedUnitPrice!: number;
}

/** Create a vendor invoice against a PurchaseOrder and run the 3-way match. */
export class CreateVendorInvoiceDto {
  @ApiProperty({ description: "Supplier's invoice number (unique per PO)" })
  @IsString()
  invoiceNumber!: string;

  @ApiProperty({ description: "ISO 8601 date the supplier dated the invoice (YYYY-MM-DD)" })
  @IsDateString()
  invoiceDate!: string;

  @ApiPropertyOptional({ description: "Payment due date (ISO 8601, YYYY-MM-DD)" })
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @ApiPropertyOptional({ description: "Currency code — defaults to AUD", default: "AUD" })
  @IsOptional()
  @IsString()
  currencyCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({ type: [VendorInvoiceLineInputDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => VendorInvoiceLineInputDto)
  lines!: VendorInvoiceLineInputDto[];
}

/** Approve a HELD invoice variance via the authority seam. */
export class ApproveInvoiceVarianceDto {
  @ApiPropertyOptional({ description: "Optional note explaining the variance approval" })
  @IsOptional()
  @IsString()
  notes?: string;
}

/** Close-reconcile a PurchaseOrder once all invoices are matched. */
export class ReconcilePoDto {
  @ApiPropertyOptional({ description: "Optional close notes for the audit record" })
  @IsOptional()
  @IsString()
  notes?: string;
}

/** Query parameters for listing vendor invoices on a PO. */
export class ListVendorInvoicesQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: InvoiceMatchStatusDto })
  @IsOptional()
  @IsEnum(InvoiceMatchStatusDto)
  status?: InvoiceMatchStatusDto;
}
