import { ApiProperty } from "@nestjs/swagger";
import { IsString, MinLength } from "class-validator";

export class ProvisionMobileAccessDto {
  @ApiProperty({
    minLength: 8,
    description: "Temporary password shown to the office user once. Worker is forced to reset it on first login."
  })
  @IsString()
  @MinLength(8)
  tempPassword!: string;
}
