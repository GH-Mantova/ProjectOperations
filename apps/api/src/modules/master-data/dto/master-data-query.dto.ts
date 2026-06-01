import { IsOptional, IsString } from "class-validator";
import { PaginationQueryDto } from "../../../common/dto/pagination-query.dto";

/**
 * Shared query DTO for every `GET /master-data/*` list endpoint — combines
 * pagination (`page`, `pageSize` from {@link PaginationQueryDto}) with an
 * optional free-text search term (`q`) interpreted per-resource by the service.
 *
 * `clientId` is only honoured by `GET /master-data/contacts` to scope the
 * polymorphic Contact table down to one organisation; it is ignored elsewhere.
 */
export class MasterDataQueryDto extends PaginationQueryDto {
  /** Case-insensitive substring matched against resource-specific name fields. */
  @IsOptional()
  @IsString()
  q?: string;

  /**
   * Scopes `GET /master-data/contacts` to CLIENT-owned contacts for one
   * organisation; ignored by other list endpoints.
   */
  @IsOptional()
  @IsString()
  clientId?: string;
}
