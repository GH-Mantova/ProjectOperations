import { IsEmail, IsString, Length } from "class-validator";

export class RequestOtpDto {
  @IsEmail()
  email!: string;
}

export class VerifyOtpDto {
  @IsEmail()
  email!: string;

  // 6-digit numeric code. Kept as a string (not a number) so a leading
  // zero survives validation and JSON round-tripping.
  @IsString()
  @Length(6, 6)
  code!: string;
}
