import {
  IsDateString,
  IsIn,
  IsNumberString,
  IsOptional,
  IsString
} from "class-validator";

export class UpdateProjectDto {
  @IsOptional() @IsString() name?: string;

  @IsOptional() @IsString() siteAddressLine1?: string;
  @IsOptional() @IsString() siteAddressLine2?: string;
  @IsOptional() @IsString() siteAddressSuburb?: string;
  @IsOptional() @IsString() siteAddressState?: string;
  @IsOptional() @IsString() siteAddressPostcode?: string;

  @IsOptional() @IsNumberString() contractValue?: string;
  @IsOptional() @IsNumberString() budget?: string;
  @IsOptional() @IsNumberString() actualCost?: string;

  @IsOptional() @IsDateString() proposedStartDate?: string;
  @IsOptional() @IsDateString() actualStartDate?: string;
  @IsOptional() @IsDateString() practicalCompletionDate?: string;
  @IsOptional() @IsDateString() closedDate?: string;

  @IsOptional() @IsString() projectManagerId?: string | null;
  @IsOptional() @IsString() supervisorId?: string | null;
  @IsOptional() @IsString() estimatorId?: string | null;
  @IsOptional() @IsString() whsOfficerId?: string | null;
}

const STATUSES = ["MOBILISING", "ACTIVE", "PRACTICAL_COMPLETION", "DEFECTS", "CLOSED"] as const;

export class ProjectStatusDto {
  @IsIn(STATUSES as unknown as string[])
  status!: string;

  @IsOptional() @IsDateString() actualStartDate?: string;
  @IsOptional() @IsDateString() practicalCompletionDate?: string;
  @IsOptional() @IsDateString() closedDate?: string;
}

export class ListProjectsQueryDto {
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() clientId?: string;
  @IsOptional() @IsString() pmId?: string;
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsNumberString() page?: string;
  @IsOptional() @IsNumberString() limit?: string;
}
