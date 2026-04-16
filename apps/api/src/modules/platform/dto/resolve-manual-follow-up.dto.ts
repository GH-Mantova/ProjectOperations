import { IsIn, IsOptional, IsString } from "class-validator";

export class ResolveManualFollowUpDto {
  @IsIn(["UNBLOCKED", "WAITING_EXTERNAL", "REASSIGNED", "WATCH_CONTINUES"])
  outcomeCode!: "UNBLOCKED" | "WAITING_EXTERNAL" | "REASSIGNED" | "WATCH_CONTINUES";

  @IsOptional()
  @IsString()
  resolutionNote?: string;
}
