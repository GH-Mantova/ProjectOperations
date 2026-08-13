import {
  IsBoolean,
  IsEmail,
  IsNumber,
  IsOptional,
  IsString,
  MinLength
} from 'class-validator';

// Self-contained (no @nestjs/mapped-types — not a declared dependency of apps/api).
// All fields are optional for PATCH semantics. Mirrors CreateEntryDto fields plus
// the `stage` field (validated at service layer against the allowed OpportunityStage set).
export class UpdateEntryDto {
  @IsOptional() @IsString() @MinLength(1) title?: string;
  @IsOptional() @IsBoolean() isLead?: boolean;
  @IsOptional() @IsString() source?: string;
  @IsOptional() @IsString() stage?: string;
  @IsOptional() @IsNumber() estimatedValue?: number;
  @IsOptional() @IsString() clientId?: string;
  @IsOptional() @IsString() contactId?: string;
  @IsOptional() @IsString() ownerId?: string;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsString() nextActionAt?: string;
  @IsOptional() @IsString() nextActionNote?: string;
  @IsOptional() @IsString() companyName?: string;
  @IsOptional() @IsString() contactName?: string;
  @IsOptional() @IsEmail() contactEmail?: string;
  @IsOptional() @IsString() contactPhone?: string;
}
