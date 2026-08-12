import { IsOptional, IsBoolean, IsString, MinLength, MaxLength, IsInt, Min } from 'class-validator';

// Self-contained (no @nestjs/mapped-types â€” that module is not a dependency of
// apps/api and its import failed with TS2307). All fields optional for PATCH.
export class UpdateDropReasonDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(200) label?: string;
  @IsOptional() @IsInt() @Min(0) sortOrder?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
