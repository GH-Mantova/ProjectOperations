import { IsOptional, IsString } from "class-validator";
import { PaginationQueryDto } from "../../../common/dto/pagination-query.dto";

/**
 * Query string for the jobs list endpoints (`GET /jobs` and
 * `GET /jobs/archive`). Inherits `page` + `pageSize` from
 * {@link PaginationQueryDto}; `q` does a case-insensitive match against
 * `jobNumber`, `name`, and the linked `client.name`.
 */
export class JobQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  q?: string;
}
