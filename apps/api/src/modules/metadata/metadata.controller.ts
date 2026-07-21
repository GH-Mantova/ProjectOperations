import { Controller, Get, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { MetadataService } from "./metadata.service";

@ApiTags("Metadata")
@ApiBearerAuth()
@Controller("meta")
@UseGuards(JwtAuthGuard)
export class MetadataController {
  constructor(private readonly service: MetadataService) {}

  @Get("catalog")
  @ApiOperation({
    summary: "Runtime data-model catalog for the Smart Wizard",
    description:
      "Returns the current metadata-catalog.json read fresh from disk. The Smart Wizard reads this at runtime — adding a model to the catalog surfaces in the UI on the next request with no rebuild."
  })
  @ApiResponse({ status: 200, description: "Catalog JSON (models, fields, roles)." })
  @ApiResponse({
    status: 503,
    description: "Catalog file not present; run scripts/data-model/build-relationship-map.mjs."
  })
  getCatalog() {
    return this.service.getCatalog();
  }
}
