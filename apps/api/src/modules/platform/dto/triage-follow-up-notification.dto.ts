import { IsIn } from "class-validator";

export class TriageFollowUpNotificationDto {
  @IsIn(["OPEN", "ACKNOWLEDGED", "WATCH"])
  triageState!: "OPEN" | "ACKNOWLEDGED" | "WATCH";
}
