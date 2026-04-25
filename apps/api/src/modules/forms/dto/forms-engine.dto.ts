import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsNumber, IsObject, IsOptional, IsString, MaxLength } from "class-validator";

export class CreateDraftDto {
  @ApiProperty()
  @IsString()
  templateId!: string;
}

export class UpdateSubmissionValuesDto {
  @ApiProperty({ description: "fieldKey → value map. Only fields included are updated." })
  @IsObject()
  values!: Record<string, unknown>;
}

export class SubmitSubmissionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  gpsLat?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  gpsLng?: number;
}

export class ApproveSubmissionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comment?: string;
}

export class RejectSubmissionDto {
  @ApiProperty({ description: "Required — sent to submitter as the rejection reason." })
  @IsString()
  @MaxLength(2000)
  comment!: string;
}
