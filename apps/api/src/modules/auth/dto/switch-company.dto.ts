import { IsString, IsNotEmpty } from "class-validator";

export class SwitchCompanyDto {
  @IsString()
  @IsNotEmpty()
  tenantId!: string;
}
