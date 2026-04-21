import { Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
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

  // Ordered list of field keys the widget should render (PR #43 dashboard v2).
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  fields?: string[];
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

  // Grid span overrides (PR #43 dashboard v2 snap-to-grid resize).
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(4)
  colSpan?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(4)
  rowSpan?: number;

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
