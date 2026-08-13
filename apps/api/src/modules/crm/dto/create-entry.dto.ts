import {
  IsBoolean,
  IsEmail,
  IsNumber,
  IsOptional,
  IsString,
  MinLength
} from 'class-validator';

export class CreateEntryDto {
  @IsString() @MinLength(1) title!: string;
  @IsBoolean() isLead!: boolean;
  @IsOptional() @IsString() source?: string;
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
