import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  MinLength,
  ValidateIf
} from "class-validator";

/**
 * Partial update payload for an application-user.
 *
 * Only fields present are applied. Supplying `roleIds` replaces the
 * user's entire role set (delete-then-create). Supplying `password`
 * re-hashes via the auth provider. Toggling `isActive` disables sign-in
 * without deleting the account — there is no hard-delete on this DTO.
 */
export class UpdateUserDto {
  /** New email address; lowercased server-side. */
  @IsOptional()
  @IsEmail()
  email?: string;

  /** New given name. */
  @IsOptional()
  @IsString()
  firstName?: string;

  /** New family name. */
  @IsOptional()
  @IsString()
  lastName?: string;

  /** New plaintext password; re-hashed via the auth provider before storage. Minimum 8 characters. */
  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;

  /** Activation flag — false disables sign-in without deleting the account; toggling writes a `users.activation` audit entry. */
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  /** Replacement role-id set; when provided, all existing role assignments are removed first. */
  @IsOptional()
  @IsArray()
  roleIds?: string[];

  /**
   * Reporting-line manager id (cuid). Pass null to clear the reporting line.
   * Rejects any value that would create a cycle in the reporting hierarchy.
   */
  @ValidateIf((_, value) => value !== null)
  @IsOptional()
  @IsString()
  managerId?: string | null;
}
