import { IsOptional, IsString, MaxLength } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

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
}
