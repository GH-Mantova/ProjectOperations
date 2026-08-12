import { PartialType } from '@nestjs/mapped-types';
import { IsOptional, IsBoolean } from 'class-validator';
import { CreateDropReasonDto } from './create-drop-reason.dto';

export class UpdateDropReasonDto extends PartialType(CreateDropReasonDto) {
  @IsOptional() @IsBoolean() isActive?: boolean;
}
