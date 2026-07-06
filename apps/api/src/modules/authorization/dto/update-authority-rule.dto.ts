import { AuthorityScopeType } from "@prisma/client";
import { Type } from "class-transformer";
import {
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min
} from "class-validator";

/** Partial update payload for an authority rule. Only supplied fields are written. */
export class UpdateAuthorityRuleDto {
  @IsOptional()
  @IsEnum(AuthorityScopeType)
  scopeType?: AuthorityScopeType;

  @IsOptional()
  @IsString()
  scopeId?: string | null;

  @IsOptional()
  @IsString()
  action?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  limitAmount?: number | null;

  @IsOptional()
  @IsString()
  escalateToUserId?: string | null;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}
