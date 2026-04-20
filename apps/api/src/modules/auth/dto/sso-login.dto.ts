import { IsString } from "class-validator";

export class SsoLoginDto {
  @IsString()
  idToken!: string;
}
