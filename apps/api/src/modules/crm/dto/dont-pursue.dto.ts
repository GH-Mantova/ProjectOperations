import { IsOptional, IsString, MaxLength } from 'class-validator';

export class DontPursueDto {
  @IsString() dropReasonId!: string;
  @IsOptional() @IsString() @MaxLength(2000) detail?: string;
}
