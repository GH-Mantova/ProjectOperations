import { IsArray, IsBoolean, IsOptional, IsString } from "class-validator";

/**
 * Payload for creating a role.
 *
 * A role is a named bundle of permissions. Supplying `permissionIds`
 * links those permissions at creation time; omitting it creates a role
 * with no permissions, which can be linked later via update.
 */
export class CreateRoleDto {
  /** Unique role name (for example "Admin", "Estimator"). */
  @IsString()
  name!: string;

  /** Optional human-readable description shown in role management UI. */
  @IsOptional()
  @IsString()
  description?: string;

  /**
   * Marks the role as a built-in/system role. System roles are seeded
   * by the platform; this flag is informational and does not by itself
   * prevent edits or deletes at the service layer.
   */
  @IsOptional()
  @IsBoolean()
  isSystem?: boolean;

  /**
   * Optional list of permission ids to link to the new role. Each entry
   * is the id of a row in the `Permission` table (capability key).
   */
  @IsOptional()
  @IsArray()
  permissionIds?: string[];
}
