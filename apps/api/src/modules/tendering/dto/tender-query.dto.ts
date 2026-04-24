import { Transform, Type } from "class-transformer";
import { IsArray, IsIn, IsInt, IsNumberString, IsOptional, IsString, Max, Min } from "class-validator";
import { PaginationQueryDto } from "../../../common/dto/pagination-query.dto";

const SORTABLE_FIELDS = [
  "tenderNumber",
  "name",
  "title",
  "value",
  "estimatedValue",
  "dueDate",
  "createdAt",
  "updatedAt",
  "status",
  "probability"
] as const;

export type TenderSortField = (typeof SORTABLE_FIELDS)[number];

const csvToArray = ({ value }: { value: unknown }): string[] | undefined => {
  if (Array.isArray(value)) {
    return value
      .map((entry) => (typeof entry === "string" ? entry.trim() : String(entry)))
      .filter((entry) => entry.length > 0);
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    return trimmed
      .split(",")
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);
  }
  return undefined;
};

export class TenderQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @Transform(csvToArray)
  @IsArray()
  @IsString({ each: true })
  status?: string[];

  @IsOptional()
  @IsString()
  estimatorId?: string;

  @IsOptional()
  @IsString()
  clientId?: string;

  @IsOptional()
  @IsString()
  discipline?: string;

  @IsOptional()
  @IsNumberString()
  valueMin?: string;

  @IsOptional()
  @IsNumberString()
  valueMax?: string;

  @IsOptional()
  @IsString()
  dueDateFrom?: string;

  @IsOptional()
  @IsString()
  dueDateTo?: string;

  @IsOptional()
  @IsIn(["Hot", "Warm", "Cold", "hot", "warm", "cold"])
  probability?: string;

  @IsOptional()
  @Transform(csvToArray)
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsIn(SORTABLE_FIELDS)
  sortBy?: TenderSortField;

  @IsOptional()
  @IsIn(["asc", "desc"])
  sortDir?: "asc" | "desc";
}

export class BulkStatusDto {
  @IsArray()
  @IsString({ each: true })
  tenderIds!: string[];

  @IsString()
  status!: string;
}

export class QuickEditDto {
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  probability?: number | null;

  @IsOptional()
  @IsString()
  dueDate?: string | null;

  @IsOptional()
  @IsNumberString()
  value?: string | null;

  @IsOptional()
  @IsString()
  assignedEstimatorId?: string | null;
}

export { SORTABLE_FIELDS };
