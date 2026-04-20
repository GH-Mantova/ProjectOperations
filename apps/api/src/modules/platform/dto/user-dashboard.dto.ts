import { Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Min,
  ValidateNested
} from "class-validator";

const PERIODS = ["7d", "30d", "90d", "6m", "12m"] as const;

class WidgetSubConfigDto {
  @IsOptional()
  @IsIn(PERIODS as unknown as string[], { message: "period must be one of 7d/30d/90d/6m/12m" })
  period?: string | null;

  @IsOptional()
  @IsObject()
  filters?: Record<string, unknown>;
}

export class UserDashboardWidgetConfigDto {
  @IsString()
  id!: string;

  @IsString()
  type!: string;

  @IsBoolean()
  visible!: boolean;

  @IsInt()
  @Min(0)
  order!: number;

  @ValidateNested()
  @Type(() => WidgetSubConfigDto)
  config!: WidgetSubConfigDto;
}

export class UserDashboardConfigDto {
  @IsIn(PERIODS as unknown as string[])
  period!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UserDashboardWidgetConfigDto)
  widgets!: UserDashboardWidgetConfigDto[];
}

export class CreateUserDashboardDto {
  @IsString()
  name!: string;

  @IsString()
  slug!: string;

  @ValidateNested()
  @Type(() => UserDashboardConfigDto)
  config!: UserDashboardConfigDto;
}

export class UpdateUserDashboardDto {
  @IsOptional() @IsString() name?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => UserDashboardConfigDto)
  config?: UserDashboardConfigDto;
}

export class ListUserDashboardsQueryDto {
  @IsOptional() @IsString() slug?: string;
}
