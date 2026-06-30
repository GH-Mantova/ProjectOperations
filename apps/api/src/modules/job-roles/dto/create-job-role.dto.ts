import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested
} from "class-validator";
import { JobRoleRequirementDto } from "./job-role-requirement.dto";

export class CreateJobRoleDto {
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(120) name!: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) description?: string;

  @ApiPropertyOptional({ description: "Hex colour for the UI badge, e.g. #2e7d32." })
  @IsOptional()
  @IsString()
  @MaxLength(16)
  colour?: string;

  @ApiPropertyOptional({ default: true }) @IsOptional() @IsBoolean() isActive?: boolean;

  @ApiPropertyOptional({ default: 0 }) @IsOptional() @IsInt() sortOrder?: number;

  @ApiPropertyOptional({ type: [JobRoleRequirementDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => JobRoleRequirementDto)
  @ArrayUnique((r: JobRoleRequirementDto) => r.competencyId, {
    message: "Each competency may only appear once in a role's requirements."
  })
  requirements?: JobRoleRequirementDto[];
}
