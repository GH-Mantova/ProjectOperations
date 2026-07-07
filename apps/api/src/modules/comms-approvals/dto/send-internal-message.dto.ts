import { IsOptional, IsString, MaxLength, MinLength } from "class-validator";

/**
 * Payload for sending a record-anchored internal message. The sender is
 * always the caller; the recipient is any User. `entityType`/`entityId`
 * name the business record the conversation is about — the same shape used
 * by ApprovalDecision so the two surfaces line up on the record view.
 */
export class SendInternalMessageDto {
  @IsString()
  @MaxLength(80)
  entityType!: string;

  @IsString()
  @MaxLength(120)
  entityId!: string;

  @IsString()
  recipientId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  subject?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  body!: string;
}
