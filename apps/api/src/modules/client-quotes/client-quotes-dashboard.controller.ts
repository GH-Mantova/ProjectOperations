import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { ClientQuotesService } from "./client-quotes.service";

/**
 * Cross-tender aggregate reads for dashboard widgets. Sibling of
 * ClientQuotesController — the CRUD surface stays nested under
 * /tenders/:tenderId/quotes; anything spanning tenders lives here.
 */
@ApiTags("Client Quotes")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("client-quotes")
export class ClientQuotesDashboardController {
  constructor(private readonly service: ClientQuotesService) {}

  @Get("drafts-summary")
  @RequirePermissions("tenders.view")
  @ApiOperation({
    summary: "Cross-tender KPI + top-N of ClientQuotes still in DRAFT — money on the table."
  })
  @ApiResponse({
    status: 200,
    description: "{ count, totalValue, items: [{ id, quoteRef, clientName, tenderNumber, value, ... }] }"
  })
  @ApiQuery({ name: "limit", required: false, type: Number, description: "Top-N items (default 5, max 20)" })
  draftsSummary(@Query("limit") limit?: string) {
    const parsed = limit ? Number(limit) : undefined;
    return this.service.getDraftsSummary(Number.isFinite(parsed) ? parsed : undefined);
  }
}
