import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsString, Matches, MinLength } from "class-validator";

// Login uses MinLength(8) only — we don't want to enforce complexity on
// existing accounts whose password might predate the rule. Account creation
// (accept-invite) and reset-password apply the full complexity rule below.
const PASSWORD_COMPLEXITY = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
const PASSWORD_MESSAGE =
  "Password must be at least 8 characters and include lowercase, uppercase, and a number.";

export class PortalLoginDto {
  @ApiProperty()
  @IsEmail()
  email!: string;

  @ApiProperty()
  @IsString()
  @MinLength(8)
  password!: string;
}

export class PortalRefreshDto {
  @ApiProperty()
  @IsString()
  refreshToken!: string;
}

export class PortalAcceptInviteDto {
  @ApiProperty()
  @IsString()
  token!: string;

  @ApiProperty({ description: "Min 8 chars, mixed case, includes a number." })
  @IsString()
  @MinLength(8)
  @Matches(PASSWORD_COMPLEXITY, { message: PASSWORD_MESSAGE })
  password!: string;
}

export class PortalRequestResetDto {
  @ApiProperty()
  @IsEmail()
  email!: string;
}

export class PortalResetPasswordDto {
  @ApiProperty()
  @IsString()
  token!: string;

  @ApiProperty({ description: "Min 8 chars, mixed case, includes a number." })
  @IsString()
  @MinLength(8)
  @Matches(PASSWORD_COMPLEXITY, { message: PASSWORD_MESSAGE })
  newPassword!: string;
}
