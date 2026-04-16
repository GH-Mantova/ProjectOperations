import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  ValidateNested
} from "class-validator";
import { Type } from "class-transformer";

class SyncFollowUpNotificationItemDto {
  @IsString()
  promptKey!: string;

  @IsString()
  userId!: string;

  @IsString()
  title!: string;

  @IsString()
  body!: string;

  @IsString()
  severity!: string;

  @IsOptional()
  @IsString()
  linkUrl?: string;

  @IsString()
  jobId!: string;

  @IsString()
  actionTarget!: string;

  @IsOptional()
  @IsString()
  nextOwnerId?: string;

  @IsString()
  nextOwnerLabel!: string;

  @IsString()
  ownerRole!: string;

  @IsIn(["Assigned to me", "Team follow-up"])
  audienceLabel!: "Assigned to me" | "Team follow-up";

  @IsIn(["Urgent today", "Due soon", "Upcoming"])
  urgencyLabel!: "Urgent today" | "Due soon" | "Upcoming";
}

export class SyncFollowUpNotificationsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SyncFollowUpNotificationItemDto)
  items!: SyncFollowUpNotificationItemDto[];
}

