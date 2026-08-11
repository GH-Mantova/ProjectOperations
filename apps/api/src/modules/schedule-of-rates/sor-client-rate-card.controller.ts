import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags
} from "@nestjs/swagger";
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString
} from "class-validator";
import { Type } from "class-transformer";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { SorClientRateCardService } from "./sor-client-rate-card.service";
import { SorCategory } from "@prisma/client";

// ─── DTOs ─────────────────────────────────────────────────────────────────────

class AddEntryDto {
  @IsOptional() @IsString() sorRateId?: string | null;
  @IsEnum(SorCategory) category!: SorCategory;
  @IsString() position!: string;
  @IsOptional() @IsString() class?: string | null;
  @IsOptional() @IsString() unit?: string | null;
  @IsOptional() @Type(() => Number) @IsNumber() ordinary?: number | null;
  @IsOptional() @Type(() => Number) @IsNumber() oneAndHalf?: number | null;
  @IsOptional() @Type(() => Number) @IsNumber() double?: number | null;
}

class EditEntryDto {
  @IsOptional() @IsString() position?: string;
  @IsOptional() @IsString() class?: string | null;
  @IsOptional() @IsString() unit?: string | null;
  @IsOptional() @Type(() => Number) @IsNumber() ordinary?: number | null;
  @IsOptional() @Type(() => Number) @IsNumber() oneAndHalf?: number | null;
  @IsOptional() @Type(() => Number) @IsNumber() double?: number | null;
}

// ─── Controller ───────────────────────────────────────────────────────────────

/**
 * SoR S3 — per-client rate card REST surface.
 *
 * Nested under /schedule-of-rates/client-cards.
 * Permissions: `rates.manage` (same as the S1 master rate-book).
 *
 * Pattern mirrors TenderRateSetController (snapshot-override-reset).
 */
@ApiTags("Schedule of Rates — Client Rate Cards")
@ApiBearerAuth()
@Controller("schedule-of-rates/client-cards")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class SorClientRateCardController {
  constructor(private readonly service: SorClientRateCardService) {}

  // ── Period-scoped card listing ────────────────────────────────────────────

  /** List all client rate cards for a given SoR period. */
  @Get("by-period/:periodId")
  @RequirePermissions("rates.manage")
  @ApiOperation({ summary: "List all client rate cards for a SoR period." })
  @ApiParam({ name: "periodId", description: "SorPeriod id" })
  @ApiResponse({ status: 200, description: "List of client rate cards with client info." })
  @ApiResponse({ status: 404, description: "Period not found." })
  listCardsForPeriod(@Param("periodId") periodId: string) {
    return this.service.listCardsForPeriod(periodId);
  }

  /** List all client rate cards for a given client (across all periods). */
  @Get("by-client/:clientId")
  @RequirePermissions("rates.manage")
  @ApiOperation({ summary: "List all client rate cards for a client (all periods)." })
  @ApiParam({ name: "clientId", description: "Client id" })
  @ApiResponse({ status: 200, description: "List of client rate cards with period info." })
  listCardsForClient(@Param("clientId") clientId: string) {
    return this.service.listCardsForClient(clientId);
  }

  // ── Get or create card ────────────────────────────────────────────────────

  /**
   * Get or create a client rate card for a given client + period.
   * Idempotent — safe to call multiple times.
   */
  @Post("clients/:clientId/periods/:periodId")
  @RequirePermissions("rates.manage")
  @ApiOperation({ summary: "Get or create the rate card for a client + period." })
  @ApiParam({ name: "clientId", description: "Client id" })
  @ApiParam({ name: "periodId", description: "SorPeriod id" })
  @ApiResponse({ status: 201, description: "Card retrieved or created." })
  @ApiResponse({ status: 404, description: "Client or period not found." })
  getOrCreateCard(
    @Param("clientId") clientId: string,
    @Param("periodId") periodId: string,
    @CurrentUser() actor: { sub: string }
  ) {
    return this.service.getOrCreateCard(clientId, periodId, actor.sub);
  }

  // ── Merged view ───────────────────────────────────────────────────────────

  /**
   * Get the merged rate-card view for a card: master rows merged with client
   * overrides, additions, and removals. This is the canonical read for the UI.
   */
  @Get(":cardId/entries")
  @RequirePermissions("rates.manage")
  @ApiOperation({ summary: "Get the merged master+override view for a client rate card." })
  @ApiParam({ name: "cardId", description: "SorClientRateCard id" })
  @ApiResponse({ status: 200, description: "Merged rows (master / override / added / removed)." })
  @ApiResponse({ status: 404, description: "Card not found." })
  listEntries(@Param("cardId") cardId: string) {
    return this.service.listEntries(cardId);
  }

  // ── Mutations ─────────────────────────────────────────────────────────────

  /** Add a fresh entry or create an override for a master rate on this card. */
  @Post(":cardId/entries")
  @RequirePermissions("rates.manage")
  @ApiOperation({ summary: "Add an entry to a client rate card (override or fresh addition)." })
  @ApiParam({ name: "cardId", description: "SorClientRateCard id" })
  @ApiResponse({ status: 201, description: "Entry created." })
  @ApiResponse({ status: 404, description: "Card not found." })
  addEntry(
    @Param("cardId") cardId: string,
    @Body() dto: AddEntryDto,
    @CurrentUser() actor: { sub: string }
  ) {
    return this.service.addEntry(cardId, dto as never, actor.sub);
  }

  /** Edit an existing client rate entry (sets isOverride=true). */
  @Patch("entries/:entryId")
  @RequirePermissions("rates.manage")
  @ApiOperation({ summary: "Edit a client rate entry." })
  @ApiParam({ name: "entryId", description: "SorClientRateEntry id" })
  @ApiResponse({ status: 200, description: "Entry updated." })
  @ApiResponse({ status: 404, description: "Entry not found." })
  editEntry(
    @Param("entryId") entryId: string,
    @Body() dto: EditEntryDto,
    @CurrentUser() actor: { sub: string }
  ) {
    return this.service.editEntry(entryId, dto as never, actor.sub);
  }

  /** Soft-remove a master rate from a client card (isRemoved=true). */
  @Delete(":cardId/entries/by-rate/:sorRateId")
  @RequirePermissions("rates.manage")
  @ApiOperation({ summary: "Soft-remove a master rate from a client card." })
  @ApiParam({ name: "cardId", description: "SorClientRateCard id" })
  @ApiParam({ name: "sorRateId", description: "SorRate id (master rate to remove)" })
  @ApiResponse({ status: 200, description: "Rate marked as removed on this card." })
  @ApiResponse({ status: 404, description: "Card or rate not found." })
  removeEntry(
    @Param("cardId") cardId: string,
    @Param("sorRateId") sorRateId: string,
    @CurrentUser() actor: { sub: string }
  ) {
    return this.service.removeEntry(cardId, sorRateId, actor.sub);
  }

  /** Delete a fresh client addition (no master rate). */
  @Delete("entries/:entryId")
  @RequirePermissions("rates.manage")
  @ApiOperation({ summary: "Delete a fresh client-added entry (no master rate)." })
  @ApiParam({ name: "entryId", description: "SorClientRateEntry id" })
  @ApiResponse({ status: 200, description: "Entry deleted." })
  @ApiResponse({ status: 404, description: "Entry not found." })
  removeFreshEntry(
    @Param("entryId") entryId: string,
    @CurrentUser() actor: { sub: string }
  ) {
    return this.service.removeFreshEntry(entryId, actor.sub);
  }

  /** Reset a client rate card to master defaults (drops all overrides, additions, removals). */
  @Post(":cardId/reset")
  @RequirePermissions("rates.manage")
  @ApiOperation({ summary: "Reset a client rate card to master defaults." })
  @ApiParam({ name: "cardId", description: "SorClientRateCard id" })
  @ApiResponse({ status: 200, description: "{ reset: true, deletedEntries: number }" })
  @ApiResponse({ status: 404, description: "Card not found." })
  resetToDefault(
    @Param("cardId") cardId: string,
    @CurrentUser() actor: { sub: string }
  ) {
    return this.service.resetToDefault(cardId, actor.sub);
  }
}
