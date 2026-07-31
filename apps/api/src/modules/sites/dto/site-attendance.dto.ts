import { IsNumber, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

// GPS-A3: mandatory GPS on site sign-in/out. Latitude and longitude are
// required — the auto-captured reading is bundled with the event. Accuracy
// is optional (some devices don't report it) but persisted when supplied.
// The client (FieldAllocationsPage / SiteSignInCard) hard-blocks the button
// when no fix is available; server treats missing coords as a 400.

export class SignInDto {
  @ApiProperty({ description: "Site the worker is signing in to." })
  @IsString()
  siteId!: string;

  @ApiPropertyOptional({ description: "Optional Job the worker is on. A worker can work several jobs on one site — this is just a hint for reporting." })
  @IsOptional()
  @IsString()
  jobId?: string;

  @ApiPropertyOptional({ description: "How the sign-in was captured (e.g. MANUAL, OFFLINE_SYNC, KIOSK). Free-form; not enum-locked so we can add channels without a migration." })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  method?: string;

  @ApiPropertyOptional({ description: "Free-text notes (e.g. induction reason, visitor purpose)." })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @ApiProperty({ description: "Latitude captured at the moment of sign-in. Required — mirrors the client hard-block." })
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat!: number;

  @ApiProperty({ description: "Longitude captured at the moment of sign-in. Required — mirrors the client hard-block." })
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng!: number;

  @ApiPropertyOptional({ description: "Reported horizontal accuracy in metres, if the device supplied it." })
  @IsOptional()
  @IsNumber()
  @Min(0)
  accuracy?: number;
}

export class SignOutDto {
  @ApiPropertyOptional({ description: "Optional site id — if provided, only the worker's open attendance on that site is closed. Omit to close whatever open attendance the worker has." })
  @IsOptional()
  @IsString()
  siteId?: string;

  @ApiPropertyOptional({ description: "Free-text notes captured at sign-out." })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @ApiProperty({ description: "Latitude captured at the moment of sign-out. Required — mirrors the client hard-block." })
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat!: number;

  @ApiProperty({ description: "Longitude captured at the moment of sign-out. Required — mirrors the client hard-block." })
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng!: number;

  @ApiPropertyOptional({ description: "Reported horizontal accuracy in metres, if the device supplied it." })
  @IsOptional()
  @IsNumber()
  @Min(0)
  accuracy?: number;
}
