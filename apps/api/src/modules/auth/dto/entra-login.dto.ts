import { IsString } from "class-validator";

export class EntraLoginDto {
  @IsString()
  idToken!: string;
}
