import { IsBoolean, IsEmail, IsOptional, IsString, MaxLength, MinLength } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

/**
 * Payload for creating a worker profile (HR/compliance roster entry).
 * Mobile login provisioning happens separately via provisionMobileAccess.
 */
export class CreateWorkerDto {
  /** Worker's legal first name. */
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(100) firstName!: string;
  /** Worker's legal last name. */
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(100) lastName!: string;
  /** Optional preferred / known-as name used in UI. */
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) preferredName?: string;
  /** Position / trade / role (e.g. 'Operator', 'Foreman'). */
  @ApiProperty({ description: "Position / trade / role (e.g. 'Operator', 'Foreman')." })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  role!: string;
  /** Contact phone number. */
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(40) phone?: string;
  /** Contact email; required before mobile access can be provisioned. */
  @ApiPropertyOptional() @IsOptional() @IsEmail() email?: string;
  /** Emergency contact full name. */
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) emergencyContactName?: string;
  /** Emergency contact phone number. */
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(40) emergencyContactPhone?: string;
  /** Driver / operator licence number. */
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(60) licenceNumber?: string;
  /** Driver / operator licence class. */
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(60) licenceClass?: string;
  /** Comma-separated ticket list; full compliance tracking comes later. */
  @ApiPropertyOptional({ description: "Comma-separated ticket list; full compliance tracking comes later." })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  ticketNumbers?: string;
  /** Whether the worker has a mobile login; flipped true by provisionMobileAccess. Defaults to false. */
  @ApiPropertyOptional() @IsOptional() @IsBoolean() hasMobileAccess?: boolean;
}
