import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min
} from "class-validator";
import { Type } from "class-transformer";

export enum DocketTypeEnum {
  DELIVERY = "DELIVERY",
  HAULAGE = "HAULAGE",
  DISPOSAL = "DISPOSAL"
}

export class CreateDocketDto {
  @ApiProperty({ enum: DocketTypeEnum })
  @IsEnum(DocketTypeEnum)
  type!: DocketTypeEnum;

  @ApiPropertyOptional({ description: "Job ID (optional — haulage may be standalone)" })
  @IsOptional()
  @IsString()
  jobId?: string;

  @ApiPropertyOptional({ description: "Asset ID (truck/plant)" })
  @IsOptional()
  @IsString()
  assetId?: string;

  @ApiProperty({ description: "Worker (driver) ID — required" })
  @IsString()
  workerId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  materialWasteType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  quantity?: number;

  @ApiPropertyOptional({ description: "Unit: t | m3 | load" })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  unit?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  fromLocation?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  toLocation?: string;

  @ApiPropertyOptional({ description: "Name of person who received / signed for the load" })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  signedByName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  gpsLat?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  gpsLng?: number;

  @ApiProperty({ description: "ISO datetime when the load was captured / weighed" })
  @IsDateString()
  capturedAt!: string;
}

export class CreateDocketAttachmentDto {
  @ApiProperty({ description: "signature | photo | weighbridge" })
  @IsString()
  kind!: string;

  @ApiProperty({ description: "URL of the stored file (upload beforehand)" })
  @IsString()
  storageUrl!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  mimeType?: string;

  @ApiProperty({ description: "ISO datetime of capture" })
  @IsDateString()
  capturedAt!: string;
}

export class DocketListQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  jobId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  assetId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  workerId?: string;

  @ApiPropertyOptional({ enum: DocketTypeEnum })
  @IsOptional()
  @IsEnum(DocketTypeEnum)
  type?: DocketTypeEnum;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ description: "ISO date inclusive lower bound on capturedAt" })
  @IsOptional()
  @IsString()
  from?: string;

  @ApiPropertyOptional({ description: "ISO date inclusive upper bound on capturedAt" })
  @IsOptional()
  @IsString()
  to?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number;
}
