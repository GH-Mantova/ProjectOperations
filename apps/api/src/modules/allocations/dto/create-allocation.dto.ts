import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsDateString, IsEnum, IsOptional, IsString, MaxLength } from "class-validator";

export const ALLOCATION_TARGETS = ["WORKER", "ASSET"] as const;
export type AllocationTargetType = (typeof ALLOCATION_TARGETS)[number];

export class CreateAllocationDto {
  @ApiProperty({ enum: ALLOCATION_TARGETS }) @IsEnum(ALLOCATION_TARGETS) type!: AllocationTargetType;
  @ApiPropertyOptional() @IsOptional() @IsString() workerProfileId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() assetId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) roleOnProject?: string;
  @ApiProperty({ description: "ISO date string (YYYY-MM-DD or full ISO)." })
  @IsDateString()
  startDate!: string;
  @ApiPropertyOptional({ description: "ISO date string. Omit for open-ended allocations." })
  @IsOptional()
  @IsDateString()
  endDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) notes?: string;
}
