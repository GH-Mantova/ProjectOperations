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
}
