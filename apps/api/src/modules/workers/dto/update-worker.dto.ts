import { PartialType } from "@nestjs/swagger";
import { IsBooleanString, IsOptional, IsString } from "class-validator";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { CreateWorkerDto } from "./create-worker.dto";

export class UpdateWorkerDto extends PartialType(CreateWorkerDto) {}

export class ListWorkersQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsBooleanString() isActive?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() role?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() search?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() page?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() limit?: string;
}
