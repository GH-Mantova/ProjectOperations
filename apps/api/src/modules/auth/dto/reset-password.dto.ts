import { ApiProperty } from "@nestjs/swagger";
import { IsString, MinLength } from "class-validator";

export class ResetPasswordDto {
  @ApiProperty({ description: "Short-lived reset token returned by /auth/login when requiresPasswordReset is true." })
  @IsString()
  tempToken!: string;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8)
  newPassword!: string;
}
