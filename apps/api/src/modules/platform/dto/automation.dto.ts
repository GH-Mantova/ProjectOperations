import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested
} from "class-validator";
import { Type } from "class-transformer";

// The MVP whitelist of trigger events. Extending this is intentionally a code
// change (not a config change) — every new event needs a call site plus a
// review that the event surface is safe to expose.
export const AUTOMATION_TRIGGER_EVENTS = ["created", "updated", "status-changed"] as const;

// Whitelisted action types. `AutomationEngineService` refuses any type not in
// this list, so an operator cannot invoke arbitrary code via a rule config.
export const AUTOMATION_ACTION_TYPES = ["notify", "create-note", "set-field"] as const;

export class AutomationActionDto {
  @IsString()
  @IsIn(AUTOMATION_ACTION_TYPES as unknown as string[])
  type!: string;

  // Free-form action config; each handler validates its own shape at run time.
  @IsObject()
  config!: Record<string, unknown>;
}

export class AutomationTriggerDto {
  @IsString()
  @MinLength(1)
  entity!: string;

  @IsString()
  @IsIn(AUTOMATION_TRIGGER_EVENTS as unknown as string[])
  event!: string;
}

export class CreateAutomationRuleDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ValidateNested()
  @Type(() => AutomationTriggerDto)
  trigger!: AutomationTriggerDto;

  // Conditions are `{ field, op, value }` records evaluated against the event
  // payload. Missing/empty = always match. Full validation lives in the engine
  // where the operator set is defined.
  @IsOptional()
  @IsArray()
  conditions?: Array<Record<string, unknown>>;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => AutomationActionDto)
  actions!: AutomationActionDto[];

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

export class UpdateAutomationRuleDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => AutomationTriggerDto)
  trigger?: AutomationTriggerDto;

  @IsOptional()
  @IsArray()
  conditions?: Array<Record<string, unknown>>;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AutomationActionDto)
  actions?: AutomationActionDto[];

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}
