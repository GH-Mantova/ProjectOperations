import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ArchiveEntryDto {
  @IsString() archiveReasonId!: string;
  @IsOptional() @IsString() @MaxLength(2000) detail?: string;
}
