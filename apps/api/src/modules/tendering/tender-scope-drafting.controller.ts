import { Body, Controller, Param, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { TenderScopeDraftingService } from "./tender-scope-drafting.service";

class DraftScopeDto {
  @IsOptional()
  @IsString()
  correction?: string;
}

@ApiTags("Tender Scope Drafting")
@ApiBearerAuth()
@Controller("tenders/:tenderId")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class TenderScopeDraftingController {
  constructor(private readonly service: TenderScopeDraftingService) {}

  @Post("draft-scope")
  @RequirePermissions("estimates.manage")
  @ApiOperation({
    summary:
      "Ask the configured AI provider to read uploaded tender documents and propose a structured scope of works. Provider is resolved from persona settings (see /admin/ai-settings)."
  })
  @ApiResponse({
    status: 201,
    description:
      "Proposed scope items array, plus count of readable/skipped documents and the live/mock mode flag. Falls back to mock when no provider is configured."
  })
  @ApiResponse({ status: 400, description: "No documents uploaded, or only unreadable (DWG) documents uploaded." })
  @ApiResponse({ status: 404, description: "Tender not found." })
  @ApiResponse({
    status: 503,
    description:
      "Provider request failed (rate limit, quota, network) — the user-facing message is sanitised; full error logged server-side."
  })
  async draft(
    @Param("tenderId") tenderId: string,
    @Body() dto: DraftScopeDto,
    @CurrentUser() actor: { sub: string }
  ) {
    return this.service.draft(tenderId, dto.correction ?? null, actor.sub);
  }
}
