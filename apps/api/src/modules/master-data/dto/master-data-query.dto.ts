import { IsOptional, IsString } from "class-validator";
import { PaginationQueryDto } from "../../../common/dto/pagination-query.dto";

export class MasterDataQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  q?: string;

  // Used by `GET /master-data/contacts?clientId=...` to filter the polymorphic
  // Contact table down to CLIENT-owned contacts for one organisation.
  @IsOptional()
  @IsString()
  clientId?: string;
}
