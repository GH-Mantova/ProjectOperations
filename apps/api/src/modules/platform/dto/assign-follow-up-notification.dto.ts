import { IsOptional, IsString } from "class-validator";

export class AssignFollowUpNotificationDto {
  @IsString()
  userId!: string;

  @IsOptional()
  @IsString()
  userLabel?: string;
}
