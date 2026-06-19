import { IsOptional, IsString } from "class-validator";
import { PaginationQueryDto } from "../../../common/dto/pagination-query.dto";

// `role` must be declared here: the global ValidationPipe runs with
// whitelist + forbidNonWhitelisted, so any query param not on the DTO is
// rejected with 400 "property role should not exist" before the handler
// ever sees it (the original PR-63a bug — it bound @Query("role")
// separately, which does not whitelist the param).
/**
 * Query params for listing users — pagination plus an optional role filter.
 *
 * Extends PaginationQueryDto for `page` / `pageSize`. The `role` field
 * filters to users holding a role whose name contains the value
 * (case-insensitive), used by the Team panel estimator dropdown.
 */
export class ListUsersQueryDto extends PaginationQueryDto {
  /** Optional role-name filter; case-insensitive `contains` match against role names. */
  @IsOptional()
  @IsString()
  role?: string;
}
