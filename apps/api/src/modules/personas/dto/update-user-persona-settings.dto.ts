import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsOptional, IsString, MaxLength } from "class-validator";

export const PERSONA_PROVIDERS = ["anthropic", "openai", "gemini", "groq"] as const;

export class UpdateUserPersonaSettingsDto {
  @ApiPropertyOptional({
    description: "User's preferred AI provider for this persona. null/omitted = use system default (Anthropic).",
    enum: PERSONA_PROVIDERS,
    nullable: true
  })
  @IsOptional()
  @IsString()
  @IsIn([...PERSONA_PROVIDERS])
  providerOverride?: string | null;

  @ApiPropertyOptional({
    description: "User's personal addition to the persona's system prompt. Only honored if Sean enables 'allowUserInstructionOverrides' globally.",
    maxLength: 10000,
    nullable: true
  })
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  instructionOverride?: string | null;

  @ApiPropertyOptional({
    description:
      "User-supplied API key for the chosen provider. Encrypted at rest in a later PR. Only honored if Sean enables 'allowBringYourOwnKey' globally.",
    nullable: true
  })
  @IsOptional()
  @IsString()
  bringYourOwnKey?: string | null;
}
