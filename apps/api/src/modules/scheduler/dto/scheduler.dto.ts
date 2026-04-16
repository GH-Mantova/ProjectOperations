import { Type } from "class-transformer";
import { IsDateString, IsOptional, IsString } from "class-validator";
import { PaginationQueryDto } from "../../../common/dto/pagination-query.dto";

export class SchedulerQueryDto extends PaginationQueryDto {
  @IsOptional() @IsString() view?: string;
  @IsOptional() @IsString() mode?: string;
}

export class CreateShiftDto {
  @IsString()
  jobId!: string;

  @IsString()
  jobActivityId!: string;

  @IsOptional() @IsString() jobStageId?: string;
  @IsString() title!: string;
  @IsDateString() startAt!: string;
  @IsDateString() endAt!: string;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsString() workInstructions?: string;
  @IsOptional() @IsString() leadUserId?: string;
}

export class UpdateShiftDto extends CreateShiftDto {}

export class AssignWorkerDto {
  @IsString()
  workerId!: string;

  @IsOptional() @IsString() roleLabel?: string;
}

export class AssignAssetDto {
  @IsString()
  assetId!: string;
}
