import { PartialType } from '@nestjs/mapped-types';
import { IsOptional, IsBoolean, IsString, MinLength, MaxLength, IsInt, Min } from 'class-validator';
import { CreateDropReasonDto } from './create-drop-reason.dto';

export class UpdateDropReasonDto extends PartialType(CreateDropReasonDto) {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(200) label?: string;
  @IsOptional() @IsInt() @Min(0) sortOrder?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
