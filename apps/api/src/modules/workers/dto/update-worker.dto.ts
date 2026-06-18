import { PartialType } from "@nestjs/swagger";
import { IsBooleanString, IsOptional, IsString } from "class-validator";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { CreateWorkerDto } from "./create-worker.dto";

/**
 * Partial of CreateWorkerDto for PATCH updates; internalUserId is set
 * only by the mobile-access provisioning flow, never here.
 */
export class UpdateWorkerDto extends PartialType(CreateWorkerDto) {}

/**
 * Query parameters for listing worker profiles. Defaults to active workers
 * (isActive=true) unless `isActive` is explicitly "false".
 */
export class ListWorkersQueryDto {
  /** Boolean string ("true" / "false") filter on isActive; defaults to active. */
  @ApiPropertyOptional() @IsOptional() @IsBooleanString() isActive?: string;
  /** Exact case-insensitive role match. */
  @ApiPropertyOptional() @IsOptional() @IsString() role?: string;
  /** Free-text search across firstName, lastName, preferredName, role. */
  @ApiPropertyOptional() @IsOptional() @IsString() search?: string;
  /** 1-based page number; defaults to 1. */
  @ApiPropertyOptional() @IsOptional() @IsString() page?: string;
  /** Page size, clamped to 1–100; defaults to 50. */
  @ApiPropertyOptional() @IsOptional() @IsString() limit?: string;
}
