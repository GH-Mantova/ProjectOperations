import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

// Universal AI assist ("Copilot everywhere"). Small, non-streaming
// completion endpoint that reuses the existing BYOK provider path via
// AiProvidersService. The frontend AssistPanel sends the record's
// visible context + a task; the model returns a plain-text completion.
// No conversations, no tools, no persona sub-mode — this is the
// "one-shot helper" surface, not the Tendering Assistant.

const ASSIST_TASKS = ["summarise", "draft", "explain"] as const;
export type AssistTask = (typeof ASSIST_TASKS)[number];

export class AssistRequestDto {
  @ApiProperty({
    enum: ASSIST_TASKS,
    description:
      "Which built-in action the user picked. Determines the instruction the server prepends to the context. 'summarise' = concise summary of the record; 'draft' = short email/note draft about the record; 'explain' = plain-language explanation of what the record shows."
  })
  @IsString()
  @IsIn(ASSIST_TASKS as unknown as string[])
  task!: AssistTask;

  @ApiProperty({
    description:
      "The user-visible context to pass to the model. Serialised by the client from whatever the user can see on the record page — title, key fields, notes. Max 12000 chars. Never send secrets."
  })
  @IsString()
  @MinLength(1)
  @MaxLength(12000)
  context!: string;

  @ApiPropertyOptional({
    description:
      "Optional free-form instruction the user typed into the panel — e.g. 'in Colin's voice', 'in bullet points'. Appended to the task instruction. Max 500 chars."
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  instruction?: string;

  @ApiPropertyOptional({
    description:
      "Short label of the surface the panel opened from, e.g. 'tender', 'job'. Cosmetic — appears in the system prompt so the model knows what kind of record it's looking at. Max 32 chars."
  })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  surface?: string;
}

export class AssistResponseDto {
  @ApiProperty({ description: "The model's plain-text completion." })
  text!: string;

  @ApiProperty({ description: "Which provider was used (audit)." })
  provider!: string;

  @ApiProperty({ description: "Which model was used (audit)." })
  model!: string;
}
