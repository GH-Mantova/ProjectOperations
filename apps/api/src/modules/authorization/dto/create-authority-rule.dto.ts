import { AuthorityScopeType } from "@prisma/client";
import { Type } from "class-transformer";
import {
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateIf
} from "class-validator";

/**
 * Payload for creating an authority rule. `scopeId` is required for USER,
 * ROLE and DEPARTMENT scopes and must be omitted / null for GLOBAL.
 * `limitAmount` null means the rule permits any amount for this action
 * within its scope; leave `escalateToUserId` unset when no escalation
 * target applies.
 */
export class CreateAuthorityRuleDto {
  @IsEnum(AuthorityScopeType)
  scopeType!: AuthorityScopeType;

  @ValidateIf((o) => o.scopeType !== AuthorityScopeType.GLOBAL)
  @IsString()
  scopeId?: string | null;

  @IsString()
  action!: string;

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
