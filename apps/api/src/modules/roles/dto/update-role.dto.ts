import { IsArray, IsBoolean, IsOptional, IsString } from "class-validator";

/**
 * Payload for updating a role.
 *
 * All fields are optional; only supplied fields are written. Supplying
 * `permissionIds` fully replaces the role's permission set (delete-then-
 * create) — pass an empty array to clear permissions, or omit the field
 * to leave existing permissions untouched.
 */
export class UpdateRoleDto {
  /** New role name. Omit to leave unchanged. */
  @IsOptional()
  @IsString()
  name?: string;

  /** New description. Omit to leave unchanged. */
  @IsOptional()
  @IsString()
  description?: string;

  /** New `isSystem` flag. Omit to leave unchanged. */
  @IsOptional()
  @IsBoolean()
  isSystem?: boolean;

  /**
   * Replacement permission id set. When supplied, the role's existing
   * rolePermission rows are deleted and recreated from this list. Omit
   * to leave permissions unchanged; pass `[]` to clear them.
   */
  @IsOptional()
  @IsArray()
  permissionIds?: string[];
}
