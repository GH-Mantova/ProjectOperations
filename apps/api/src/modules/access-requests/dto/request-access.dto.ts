import { IsOptional, IsString, MaxLength } from "class-validator";

/**
 * Body for POST /auth/request-access. The user identity comes from the
 * validated Entra idToken — the caller is a would-be user who has just
 * been gated by /auth/sso (ENTRA_NOT_REGISTERED). We never trust a
 * client-supplied email.
 */
export class RequestAccessDto {
  @IsString()
  idToken!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  message?: string;
}
