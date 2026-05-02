import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsArray, IsBoolean, IsIn, IsOptional, IsString } from "class-validator";
import { PERSONA_PROVIDERS } from "./update-user-persona-settings.dto";

export class UpdateGlobalAISettingsDto {
  @ApiPropertyOptional({
    description: "Master toggle: allow users to add personal instruction overrides to any persona's system prompt."
  })
  @IsOptional()
  @IsBoolean()
  allowUserInstructionOverrides?: boolean;

  @ApiPropertyOptional({
    description: "AI providers users may select from. At least one must be enabled.",
    enum: PERSONA_PROVIDERS,
    isArray: true
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @IsIn([...PERSONA_PROVIDERS], { each: true })
  enabledProviders?: string[];

  @ApiPropertyOptional({
    description: "Master toggle: allow users to supply their own API keys (BYOK)."
  })
  @IsOptional()
  @IsBoolean()
  allowBringYourOwnKey?: boolean;
}
