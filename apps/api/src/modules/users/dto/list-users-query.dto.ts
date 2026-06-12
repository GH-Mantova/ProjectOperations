import { IsOptional, IsString } from "class-validator";
import { PaginationQueryDto } from "../../../common/dto/pagination-query.dto";

// `role` must be declared here: the global ValidationPipe runs with
// whitelist + forbidNonWhitelisted, so any query param not on the DTO is
// rejected with 400 "property role should not exist" before the handler
// ever sees it (the original PR-63a bug — it bound @Query("role")
// separately, which does not whitelist the param).
export class ListUsersQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  role?: string;
}
