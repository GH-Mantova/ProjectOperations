import { IsArray, IsEmail, IsOptional, IsString, MinLength } from "class-validator";

/**
 * Payload for creating an application-user (login account).
 *
 * Distinct from the worker-record DTOs — this creates an account that can
 * sign in to the platform, not a field-personnel record. The plaintext
 * password is hashed via the auth provider before storage; the email is
 * lowercased before the uniqueness check.
 */
export class CreateUserDto {
  /** Email address; lowercased server-side and used as the login identifier. */
  @IsEmail()
  email!: string;

  /** Given name as it appears in the UI and audit entries. */
  @IsString()
  firstName!: string;

  /** Family name as it appears in the UI and audit entries. */
  @IsString()
  lastName!: string;

  /** Plaintext password; hashed via the auth provider before storage. Minimum 8 characters. */
  @IsString()
  @MinLength(8)
  password!: string;

  /** Optional initial role ids; each becomes a UserRole row on creation. */
  @IsOptional()
  @IsArray()
  roleIds?: string[];
}
