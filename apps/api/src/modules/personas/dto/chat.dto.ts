import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { ArrayMinSize, IsArray, IsIn, IsOptional, IsString, MaxLength, ValidateNested } from "class-validator";

export class ChatMessageDto {
  @ApiProperty({ enum: ["user", "assistant"] })
  @IsString()
  @IsIn(["user", "assistant"])
  role!: "user" | "assistant";

  @ApiProperty({ description: "Message text. Max 32000 chars." })
  @IsString()
  @MaxLength(32000)
  content!: string;
}

export class ChatRequestDto {
  @ApiProperty({
    type: [ChatMessageDto],
    description:
      "Full conversation history (oldest first). The last message must be from role 'user'. The server appends the system prompt — clients should not include a system message here."
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ChatMessageDto)
  messages!: ChatMessageDto[];

  @ApiPropertyOptional({
    description:
      "Optional active sub-mode name (e.g. 'scope', 'estimate'). Used to enrich the system prompt so the assistant knows which tendering tab the user is on."
  })
  @IsOptional()
  @IsString()
  @IsIn(["pipeline", "register", "tender-detail", "scope", "estimate", "quote", "clarifications"])
  subMode?: string;

  @ApiPropertyOptional({
    description:
      "§5A.1 PR 10 — context-scope key for conversation persistence. Tender id for tender-detail/scope/estimate/quote/clarifications; null/omitted for pipeline/register. Server pairs this with subMode to find or create the active conversation."
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  contextKey?: string | null;

  @ApiPropertyOptional({
    description:
      "§5A.1 PR 10 — explicit conversation id to append messages to. When omitted, the server resolves the active conversation for the (user, personaSlug, subMode, contextKey) scope, creating one if needed."
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  conversationId?: string;
}

export class StartConversationDto {
  @ApiProperty({
    enum: ["pipeline", "register", "tender-detail", "scope", "estimate", "quote", "clarifications"]
  })
  @IsString()
  @IsIn(["pipeline", "register", "tender-detail", "scope", "estimate", "quote", "clarifications"])
  subMode!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  contextKey?: string | null;
}
