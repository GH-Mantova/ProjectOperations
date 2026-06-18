import { ApiProperty } from "@nestjs/swagger";
import { IsString, MinLength } from "class-validator";

/**
 * Payload for provisioning a Field Worker login against a worker profile.
 * The temp password is hashed before storage and shown to the office user
 * once; the worker is forced to reset it on first login.
 */
export class ProvisionMobileAccessDto {
  /** Temporary password shown to the office user once; min 8 chars. Worker is forced to reset on first login. */
  @ApiProperty({
    minLength: 8,
    description: "Temporary password shown to the office user once. Worker is forced to reset it on first login."
  })
  @IsString()
  @MinLength(8)
  tempPassword!: string;
}
