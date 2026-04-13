import { Type } from "class-transformer";
import { IsArray, IsBoolean, IsInt, IsOptional, IsString, ValidateNested } from "class-validator";

export class CreateDashboardWidgetDto {
  @IsString()
  type!: string;

  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsInt()
  position!: number;

  @IsOptional()
  @IsInt()
  width?: number;

  @IsOptional()
  @IsInt()
  height?: number;

  @IsOptional()
  config?: Record<string, unknown>;
}

export class CreateDashboardDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  scope!: string;

  @IsOptional()
  @IsString()
  ownerRoleId?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateDashboardWidgetDto)
  widgets?: CreateDashboardWidgetDto[];
}

export class UpdateDashboardDto extends CreateDashboardDto {}
