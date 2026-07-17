import { IsDateString, IsIn, IsOptional, IsString, MaxLength } from "class-validator";

export const PUNCH_STATUSES = ["OPEN", "IN_PROGRESS", "CLOSED"] as const;
export type PunchStatus = (typeof PUNCH_STATUSES)[number];

export class CreatePunchItemDto {
  @IsString() @MaxLength(200)
  title!: string;

  @IsOptional() @IsString() @MaxLength(4000)
  description?: string;

  @IsOptional() @IsString() @MaxLength(200)
  location?: string;

  @IsOptional() @IsString()
  assignedToId?: string;

  @IsOptional() @IsDateString()
  dueAt?: string;

  @IsOptional() @IsString() @MaxLength(2000)
  photoUrl?: string;

  @IsOptional() @IsString()
  submissionId?: string;
}

export class UpdatePunchItemDto {
  @IsOptional() @IsString() @MaxLength(200)
  title?: string;

  @IsOptional() @IsString() @MaxLength(4000)
  description?: string;

  @IsOptional() @IsString() @MaxLength(200)
  location?: string;

  @IsOptional() @IsIn(PUNCH_STATUSES as unknown as string[])
  status?: PunchStatus;

  @IsOptional() @IsString()
  assignedToId?: string | null;

  @IsOptional() @IsDateString()
  dueAt?: string | null;

  @IsOptional() @IsString() @MaxLength(2000)
  photoUrl?: string | null;
}

export class ClosePunchItemDto {
  @IsOptional() @IsString() @MaxLength(4000)
  closureNote?: string;

  @IsOptional() @IsString() @MaxLength(2000)
  photoUrl?: string;
}

export class ListPunchItemsQueryDto {
  @IsOptional() @IsIn(PUNCH_STATUSES as unknown as string[])
  status?: PunchStatus;

  @IsOptional() @IsString()
  assignedToId?: string;
}
