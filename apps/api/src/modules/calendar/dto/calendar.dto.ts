import { ApiProperty } from "@nestjs/swagger";

export class CalendarSyncStatusDto {
  @ApiProperty({ enum: ["mock", "live"], description: "Active calendar adapter mode" })
  mode!: "mock" | "live";

  @ApiProperty({ description: "Total active synced events for the current user" })
  activeCount!: number;

  @ApiProperty({ description: "Total cancelled synced events still on file" })
  cancelledCount!: number;

  @ApiProperty({ nullable: true, type: String, description: "Last sync timestamp (ISO 8601)" })
  lastSyncedAt!: string | null;
}

export class CalendarSyncRunResultDto {
  @ApiProperty({ description: "Events created on this run" })
  created!: number;

  @ApiProperty({ description: "Events updated on this run" })
  updated!: number;

  @ApiProperty({ description: "Events cancelled because the source shift is no longer syncable" })
  cancelled!: number;

  @ApiProperty({ description: "Total events the adapter currently considers active for this user" })
  activeCount!: number;
}

export class CalendarSyncedEventDto {
  @ApiProperty() id!: string;
  @ApiProperty() sourceType!: string;
  @ApiProperty() sourceId!: string;
  @ApiProperty() externalEventId!: string;
  @ApiProperty() title!: string;
  @ApiProperty({ description: "ISO 8601" }) startAt!: string;
  @ApiProperty({ description: "ISO 8601" }) endAt!: string;
  @ApiProperty({ nullable: true, type: String }) location!: string | null;
  @ApiProperty({ enum: ["active", "cancelled"] }) status!: "active" | "cancelled";
  @ApiProperty({ description: "ISO 8601" }) lastSyncedAt!: string;
}
