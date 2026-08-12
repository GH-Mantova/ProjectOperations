import { IsString, MinLength, MaxLength, IsOptional, IsInt, Min } from 'class-validator';

export class CreateDropReasonDto {
  @IsString() @MinLength(1) @MaxLength(200) label!: string;
  @IsOptional() @IsInt() @Min(0) sortOrder?: number;
}
