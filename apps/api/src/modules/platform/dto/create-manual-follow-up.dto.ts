import { IsIn, IsOptional, IsString } from "class-validator";

export class CreateManualFollowUpDto {
  @IsString()
  userId!: string;

  @IsString()
  jobId!: string;

  @IsOptional()
  @IsString()
  activityId?: string;

  @IsString()
  title!: string;

  @IsString()
  body!: string;

  @IsIn(["HIGH", "MEDIUM", "LOW"])
  severity!: "HIGH" | "MEDIUM" | "LOW";

  @IsIn(["HANDOFF", "ESCALATION"])
  manualType!: "HANDOFF" | "ESCALATION";

  @IsString()
  reasonCode!: string;

  @IsOptional()
  @IsString()
  reasonDetail?: string;

  @IsIn(["job", "documents"])
  actionTarget!: "job" | "documents";

  @IsString()
  nextOwnerLabel!: string;

  @IsString()
  ownerRole!: string;

  @IsIn(["Urgent today", "Due soon", "Upcoming"])
  urgencyLabel!: "Urgent today" | "Due soon" | "Upcoming";

  @IsOptional()
  @IsString()
  linkUrl?: string;
}
