import { IsOptional, IsString, MaxLength } from "class-validator";

/**
 * Query for listing internal messages. Both filters are optional; when
 * neither is provided the service returns the caller's inbox (messages
 * they received), unread-first. When both are provided it returns the
 * thread on that record involving the caller.
 */
export class ListInternalMessagesQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  entityType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  entityId?: string;
}
