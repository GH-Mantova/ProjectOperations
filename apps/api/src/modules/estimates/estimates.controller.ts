import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import {
  UpdateAssumptionDto,
  UpdateCuttingLineDto,
  UpdateEquipLineDto,
  UpdateEstimateDto,
  UpdateEstimateItemDto,
  UpdateLabourLineDto,
  UpdatePlantLineDto,
  UpdateWasteLineDto,
  UpsertAssumptionDto,
  UpsertCoreHoleRateDto,
  UpsertCuttingLineDto,
  UpsertCuttingRateDto,
  UpsertEnclosureRateDto,
  UpsertEquipLineDto,
  UpsertEstimateItemDto,
  UpsertFuelRateDto,
  UpsertLabourLineDto,
  UpsertLabourRateDto,
  UpsertMaterialDensityDto,
  UpsertOtherRateDto,
  UpsertPlantLineDto,
  UpsertPlantRateDto,
  UpsertWasteLineDto,
  UpsertWasteRateDto
} from "./dto/estimates.dto";
import { EstimatesService } from "./estimates.service";

/**
 * REST endpoints for the estimating module: the global rate library
 * (labour/plant/waste/cutting/core-hole/fuel/enclosure/other/density)
 * and the per-tender estimate with its scope items, cost lines and
 * assumptions.
 *
 * Permission gating: `estimates.view` for reads, `estimates.manage` for
 * tender-estimate edits, `estimates.admin` for rate-library writes and
 * estimate unlock. Mutating endpoints return the full refreshed estimate
 * so the client can re-render without a follow-up GET.
 */
@ApiTags("Estimates")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller()
export class EstimatesController {
  constructor(private readonly service: EstimatesService) {}

  // ──────────────────────────────────────────────────────────────
  //  Rate library — labour
  // ──────────────────────────────────────────────────────────────

  /**
   * List labour rates (rate library).
   *
   * @returns labour rates, active first then by sortOrder/role
   */
  @Get("estimate-rates/labour")
  @RequirePermissions("estimates.view")
  @ApiOperation({ summary: "List labour rates (rate library)" })
  @ApiResponse({ status: 200, description: "Ordered list of labour rates." })
  listLabourRates() {
    return this.service.listLabourRates();
  }

  /**
   * Create a labour rate.
   *
   * @param dto - role plus day/night/weekend rates
   * @returns the created rate (audited)
   */
  @Post("estimate-rates/labour")
  @RequirePermissions("estimates.admin")
  @ApiOperation({ summary: "Create a labour rate" })
  @ApiResponse({ status: 201, description: "Labour rate created." })
  createLabourRate(@Body() dto: UpsertLabourRateDto, @CurrentUser() actor: { sub: string }) {
    return this.service.upsertLabourRate(undefined, dto, actor.sub);
  }

  /**
   * Update a labour rate.
   *
   * @returns the updated rate (audited)
   */
  @Patch("estimate-rates/labour/:id")
  @RequirePermissions("estimates.admin")
  @ApiOperation({ summary: "Update a labour rate" })
  @ApiResponse({ status: 200, description: "Labour rate updated." })
  updateLabourRate(@Param("id") id: string, @Body() dto: UpsertLabourRateDto, @CurrentUser() actor: { sub: string }) {
    return this.service.upsertLabourRate(id, dto, actor.sub);
  }

  /**
   * Delete a labour rate (hard delete, audited).
   *
   * @returns `{ id }` of the deleted rate
   */
  @Delete("estimate-rates/labour/:id")
  @RequirePermissions("estimates.admin")
  @ApiOperation({ summary: "Delete a labour rate" })
  @ApiResponse({ status: 200, description: "Labour rate deleted." })
  deleteLabourRate(@Param("id") id: string, @CurrentUser() actor: { sub: string }) {
    return this.service.deleteLabourRate(id, actor.sub);
  }

  // ──────────────────────────────────────────────────────────────
  //  Rate library — plant
  // ──────────────────────────────────────────────────────────────

  /**
   * List plant rates (rate library).
   *
   * @returns plant rates, active first then by sortOrder/item
   */
  @Get("estimate-rates/plant")
  @RequirePermissions("estimates.view")
  @ApiOperation({ summary: "List plant rates (rate library)" })
  @ApiResponse({ status: 200, description: "List plant rates (rate library)." })
  listPlantRates() {
    return this.service.listPlantRates();
  }

  /**
   * Create a plant rate.
   *
   * @param dto - plant item, unit (defaults "day"), rate and optional fuelRate
   * @returns the created rate (audited)
   */
  @Post("estimate-rates/plant")
  @RequirePermissions("estimates.admin")
  @ApiOperation({ summary: "Create a plant rate" })
  @ApiResponse({ status: 201, description: "Create a plant rate." })
  createPlantRate(@Body() dto: UpsertPlantRateDto, @CurrentUser() actor: { sub: string }) {
    return this.service.upsertPlantRate(undefined, dto, actor.sub);
  }

  /**
   * Update a plant rate.
   *
   * @returns the updated rate (audited)
   */
  @Patch("estimate-rates/plant/:id")
  @RequirePermissions("estimates.admin")
  @ApiOperation({ summary: "Update a plant rate" })
  @ApiResponse({ status: 200, description: "Update a plant rate." })
  updatePlantRate(@Param("id") id: string, @Body() dto: UpsertPlantRateDto, @CurrentUser() actor: { sub: string }) {
    return this.service.upsertPlantRate(id, dto, actor.sub);
  }

  /**
   * Delete a plant rate (hard delete, audited).
   *
   * @returns `{ id }` of the deleted rate
   */
  @Delete("estimate-rates/plant/:id")
  @RequirePermissions("estimates.admin")
  @ApiOperation({ summary: "Delete a plant rate" })
  @ApiResponse({ status: 200, description: "Delete a plant rate." })
  deletePlantRate(@Param("id") id: string, @CurrentUser() actor: { sub: string }) {
    return this.service.deletePlantRate(id, actor.sub);
  }

  // ──────────────────────────────────────────────────────────────
  //  Rate library — waste
  // ──────────────────────────────────────────────────────────────

  /**
   * List waste rates (rate library).
   *
   * @returns waste rates, active first then by sortOrder/wasteType/facility
   */
  @Get("estimate-rates/waste")
  @RequirePermissions("estimates.view")
  @ApiOperation({ summary: "List waste rates (rate library)" })
  @ApiResponse({ status: 200, description: "List waste rates (rate library)." })
  listWasteRates() {
    return this.service.listWasteRates();
  }

  /**
   * Create a waste rate.
   *
   * @param dto - waste type/facility plus per-tonne and per-load rates
   * @returns the created rate (audited)
   */
  @Post("estimate-rates/waste")
  @RequirePermissions("estimates.admin")
  @ApiOperation({ summary: "Create a waste rate" })
  @ApiResponse({ status: 201, description: "Create a waste rate." })
  createWasteRate(@Body() dto: UpsertWasteRateDto, @CurrentUser() actor: { sub: string }) {
    return this.service.upsertWasteRate(undefined, dto, actor.sub);
  }

  /**
   * Update a waste rate.
   *
   * @returns the updated rate (audited)
   */
  @Patch("estimate-rates/waste/:id")
  @RequirePermissions("estimates.admin")
  @ApiOperation({ summary: "Update a waste rate" })
  @ApiResponse({ status: 200, description: "Update a waste rate." })
  updateWasteRate(@Param("id") id: string, @Body() dto: UpsertWasteRateDto, @CurrentUser() actor: { sub: string }) {
    return this.service.upsertWasteRate(id, dto, actor.sub);
  }

  /**
   * Delete a waste rate (hard delete, audited).
   *
   * @returns `{ id }` of the deleted rate
   */
  @Delete("estimate-rates/waste/:id")
  @RequirePermissions("estimates.admin")
  @ApiOperation({ summary: "Delete a waste rate" })
  @ApiResponse({ status: 200, description: "Delete a waste rate." })
  deleteWasteRate(@Param("id") id: string, @CurrentUser() actor: { sub: string }) {
    return this.service.deleteWasteRate(id, actor.sub);
  }

  // ──────────────────────────────────────────────────────────────
  //  Rate library — cutting
  // ──────────────────────────────────────────────────────────────

  /**
   * List cutting rates (rate library).
   *
   * @returns cutting rates ordered by equipment/material/elevation/depth
   */
  @Get("estimate-rates/cutting")
  @RequirePermissions("estimates.view")
  @ApiOperation({ summary: "List cutting rates (rate library)" })
  @ApiResponse({ status: 200, description: "List cutting rates (rate library)." })
  listCuttingRates() {
    return this.service.listCuttingRates();
  }

  /**
   * Create a cutting rate.
   *
   * @param dto - equipment/elevation/material/depth combo with rate per metre
   * @returns the created rate (audited)
   */
  @Post("estimate-rates/cutting")
  @RequirePermissions("estimates.admin")
  @ApiOperation({ summary: "Create a cutting rate" })
  @ApiResponse({ status: 201, description: "Create a cutting rate." })
  createCuttingRate(@Body() dto: UpsertCuttingRateDto, @CurrentUser() actor: { sub: string }) {
    return this.service.upsertCuttingRate(undefined, dto, actor.sub);
  }

  /**
   * Update a cutting rate.
   *
   * @returns the updated rate (audited)
   */
  @Patch("estimate-rates/cutting/:id")
  @RequirePermissions("estimates.admin")
  @ApiOperation({ summary: "Update a cutting rate" })
  @ApiResponse({ status: 200, description: "Update a cutting rate." })
  updateCuttingRate(@Param("id") id: string, @Body() dto: UpsertCuttingRateDto, @CurrentUser() actor: { sub: string }) {
    return this.service.upsertCuttingRate(id, dto, actor.sub);
  }

  /**
   * Delete a cutting rate (hard delete, audited).
   *
   * @returns `{ id }` of the deleted rate
   */
  @Delete("estimate-rates/cutting/:id")
  @RequirePermissions("estimates.admin")
  @ApiOperation({ summary: "Delete a cutting rate" })
  @ApiResponse({ status: 200, description: "Delete a cutting rate." })
  deleteCuttingRate(@Param("id") id: string, @CurrentUser() actor: { sub: string }) {
    return this.service.deleteCuttingRate(id, actor.sub);
  }

  // ──────────────────────────────────────────────────────────────
  //  Rate library — core holes
  // ──────────────────────────────────────────────────────────────

  /**
   * List concrete core-hole drilling rates ($/hole by diameter).
   *
   * @returns core-hole rates, active first then by diameter
   */
  @Get("estimate-rates/core-holes")
  @RequirePermissions("estimates.view")
  @ApiOperation({ summary: "List concrete core-hole drilling rates ($/hole by diameter)" })
  @ApiResponse({ status: 200, description: "List concrete core-hole drilling rates ($/hole by diameter)." })
  listCoreHoleRates() {
    return this.service.listCoreHoleRates();
  }

  /**
   * Create a core-hole rate.
   *
   * @param dto - diameter in mm and rate per hole
   * @returns the created rate (audited)
   */
  @Post("estimate-rates/core-holes")
  @RequirePermissions("estimates.admin")
  @ApiOperation({ summary: "Create a core-hole rate" })
  @ApiResponse({ status: 201, description: "Create a core-hole rate." })
  createCoreHoleRate(@Body() dto: UpsertCoreHoleRateDto, @CurrentUser() actor: { sub: string }) {
    return this.service.upsertCoreHoleRate(undefined, dto, actor.sub);
  }

  /**
   * Update a core-hole rate.
   *
   * @returns the updated rate (audited)
   */
  @Patch("estimate-rates/core-holes/:id")
  @RequirePermissions("estimates.admin")
  @ApiOperation({ summary: "Update a core-hole rate" })
  @ApiResponse({ status: 200, description: "Update a core-hole rate." })
  updateCoreHoleRate(@Param("id") id: string, @Body() dto: UpsertCoreHoleRateDto, @CurrentUser() actor: { sub: string }) {
    return this.service.upsertCoreHoleRate(id, dto, actor.sub);
  }

  /**
   * Delete a core-hole rate (hard delete, audited).
   *
   * @returns `{ id }` of the deleted rate
   */
  @Delete("estimate-rates/core-holes/:id")
  @RequirePermissions("estimates.admin")
  @ApiOperation({ summary: "Delete a core-hole rate" })
  @ApiResponse({ status: 200, description: "Delete a core-hole rate." })
  deleteCoreHoleRate(@Param("id") id: string, @CurrentUser() actor: { sub: string }) {
    return this.service.deleteCoreHoleRate(id, actor.sub);
  }

  // ──────────────────────────────────────────────────────────────
  //  Rate library — fuel
  // ──────────────────────────────────────────────────────────────

  /**
   * List fuel rates (rate library).
   *
   * @returns fuel rates, active first then by sortOrder/item
   */
  @Get("estimate-rates/fuel")
  @RequirePermissions("estimates.view")
  @ApiOperation({ summary: "List fuel rates (rate library)" })
  @ApiResponse({ status: 200, description: "List fuel rates (rate library)." })
  listFuelRates() {
    return this.service.listFuelRates();
  }

  /**
   * Create a fuel rate.
   *
   * @param dto - item, unit and rate
   * @returns the created rate (audited)
   */
  @Post("estimate-rates/fuel")
  @RequirePermissions("estimates.admin")
  @ApiOperation({ summary: "Create a fuel rate" })
  @ApiResponse({ status: 201, description: "Create a fuel rate." })
  createFuelRate(@Body() dto: UpsertFuelRateDto, @CurrentUser() actor: { sub: string }) {
    return this.service.upsertFuelRate(undefined, dto, actor.sub);
  }

  /**
   * Update a fuel rate.
   *
   * @returns the updated rate (audited)
   */
  @Patch("estimate-rates/fuel/:id")
  @RequirePermissions("estimates.admin")
  @ApiOperation({ summary: "Update a fuel rate" })
  @ApiResponse({ status: 200, description: "Update a fuel rate." })
  updateFuelRate(@Param("id") id: string, @Body() dto: UpsertFuelRateDto, @CurrentUser() actor: { sub: string }) {
    return this.service.upsertFuelRate(id, dto, actor.sub);
  }

  /**
   * Delete a fuel rate (hard delete, audited).
   *
   * @returns `{ id }` of the deleted rate
   */
  @Delete("estimate-rates/fuel/:id")
  @RequirePermissions("estimates.admin")
  @ApiOperation({ summary: "Delete a fuel rate" })
  @ApiResponse({ status: 200, description: "Delete a fuel rate." })
  deleteFuelRate(@Param("id") id: string, @CurrentUser() actor: { sub: string }) {
    return this.service.deleteFuelRate(id, actor.sub);
  }

  // ──────────────────────────────────────────────────────────────
  //  Rate library — enclosure
  // ──────────────────────────────────────────────────────────────

  /**
   * List asbestos enclosure rates (rate library).
   *
   * @returns enclosure rates, active first then by sortOrder/type
   */
  @Get("estimate-rates/enclosure")
  @RequirePermissions("estimates.view")
  @ApiOperation({ summary: "List asbestos enclosure rates (rate library)" })
  @ApiResponse({ status: 200, description: "List asbestos enclosure rates (rate library)." })
  listEnclosureRates() {
    return this.service.listEnclosureRates();
  }

  /**
   * Create an enclosure rate.
   *
   * @param dto - enclosure type, unit and rate
   * @returns the created rate (audited)
   */
  @Post("estimate-rates/enclosure")
  @RequirePermissions("estimates.admin")
  @ApiOperation({ summary: "Create an enclosure rate" })
  @ApiResponse({ status: 201, description: "Create an enclosure rate." })
  createEnclosureRate(@Body() dto: UpsertEnclosureRateDto, @CurrentUser() actor: { sub: string }) {
    return this.service.upsertEnclosureRate(undefined, dto, actor.sub);
  }

  /**
   * Update an enclosure rate.
   *
   * @returns the updated rate (audited)
   */
  @Patch("estimate-rates/enclosure/:id")
  @RequirePermissions("estimates.admin")
  @ApiOperation({ summary: "Update an enclosure rate" })
  @ApiResponse({ status: 200, description: "Update an enclosure rate." })
  updateEnclosureRate(@Param("id") id: string, @Body() dto: UpsertEnclosureRateDto, @CurrentUser() actor: { sub: string }) {
    return this.service.upsertEnclosureRate(id, dto, actor.sub);
  }

  /**
   * Delete an enclosure rate (hard delete, audited).
   *
   * @returns `{ id }` of the deleted rate
   */
  @Delete("estimate-rates/enclosure/:id")
  @RequirePermissions("estimates.admin")
  @ApiOperation({ summary: "Delete an enclosure rate" })
  @ApiResponse({ status: 200, description: "Delete an enclosure rate." })
  deleteEnclosureRate(@Param("id") id: string, @CurrentUser() actor: { sub: string }) {
    return this.service.deleteEnclosureRate(id, actor.sub);
  }

  // ──────────────────────────────────────────────────────────────
  //  Rate library — cutting-sheet "other" rates
  // ──────────────────────────────────────────────────────────────

  /**
   * List cutting-sheet other-rate catalogue.
   *
   * @returns other-rates, active first then by sortOrder/description
   */
  @Get("estimate-rates/other-rates")
  @RequirePermissions("estimates.view")
  @ApiOperation({ summary: "List cutting-sheet other-rate catalogue" })
  @ApiResponse({ status: 200, description: "Active and inactive other-rates ordered by sortOrder." })
  listOtherRates() {
    return this.service.listOtherRates();
  }

  /**
   * Create an other-rate.
   *
   * @param dto - description, unit and rate
   * @returns the created rate (audited)
   */
  @Post("estimate-rates/other-rates")
  @RequirePermissions("estimates.admin")
  @ApiOperation({ summary: "Create an other-rate" })
  @ApiResponse({ status: 201, description: "Other rate created." })
  createOtherRate(@Body() dto: UpsertOtherRateDto, @CurrentUser() actor: { sub: string }) {
    return this.service.upsertOtherRate(undefined, dto, actor.sub);
  }

  /**
   * Update an other-rate.
   *
   * @returns the updated rate (audited)
   */
  @Patch("estimate-rates/other-rates/:id")
  @RequirePermissions("estimates.admin")
  @ApiOperation({ summary: "Update an other-rate" })
  @ApiResponse({ status: 200, description: "Other rate updated." })
  updateOtherRate(@Param("id") id: string, @Body() dto: UpsertOtherRateDto, @CurrentUser() actor: { sub: string }) {
    return this.service.upsertOtherRate(id, dto, actor.sub);
  }

  /**
   * Delete an other-rate (403 if referenced by cutting lines).
   *
   * @returns `{ id }` of the deleted rate
   * @throws ForbiddenException when cutting-sheet lines reference the rate
   */
  @Delete("estimate-rates/other-rates/:id")
  @RequirePermissions("estimates.admin")
  @ApiOperation({ summary: "Delete an other-rate (403 if referenced by cutting lines)" })
  @ApiResponse({ status: 200, description: "Other rate deleted." })
  deleteOtherRate(@Param("id") id: string, @CurrentUser() actor: { sub: string }) {
    return this.service.deleteOtherRate(id, actor.sub);
  }

  // ──────────────────────────────────────────────────────────────
  //  Rate library — material densities
  // ──────────────────────────────────────────────────────────────

  /**
   * List material densities (rate library).
   *
   * @returns densities, active first then by category/material name
   */
  @Get("estimate-rates/material-densities")
  @RequirePermissions("estimates.view")
  @ApiOperation({ summary: "List material densities (rate library)" })
  @ApiResponse({ status: 200, description: "Ordered list of material densities." })
  listMaterialDensities() {
    return this.service.listMaterialDensities();
  }

  /**
   * Create a material density.
   *
   * @param dto - material name, density value, unit and optional category/notes
   * @returns the created density (audited)
   */
  @Post("estimate-rates/material-densities")
  @RequirePermissions("estimates.admin")
  @ApiOperation({ summary: "Create a material density" })
  @ApiResponse({ status: 201, description: "Material density created." })
  createMaterialDensity(@Body() dto: UpsertMaterialDensityDto, @CurrentUser() actor: { sub: string }) {
    return this.service.upsertMaterialDensity(undefined, dto, actor.sub);
  }

  /**
   * Update a material density.
   *
   * @returns the updated density (audited)
   */
  @Patch("estimate-rates/material-densities/:id")
  @RequirePermissions("estimates.admin")
  @ApiOperation({ summary: "Update a material density" })
  @ApiResponse({ status: 200, description: "Material density updated." })
  updateMaterialDensity(@Param("id") id: string, @Body() dto: UpsertMaterialDensityDto, @CurrentUser() actor: { sub: string }) {
    return this.service.upsertMaterialDensity(id, dto, actor.sub);
  }

  /**
   * Soft-delete a material density (sets active = false).
   *
   * @returns `{ id }` of the deactivated density
   */
  @Delete("estimate-rates/material-densities/:id")
  @RequirePermissions("estimates.admin")
  @ApiOperation({ summary: "Soft-delete a material density (sets active = false)" })
  @ApiResponse({ status: 200, description: "Material density deactivated." })
  deleteMaterialDensity(@Param("id") id: string, @CurrentUser() actor: { sub: string }) {
    return this.service.deleteMaterialDensity(id, actor.sub);
  }

  // ──────────────────────────────────────────────────────────────
  //  Estimate lifecycle (one per tender)
  // ──────────────────────────────────────────────────────────────

  /**
   * Get the estimate for a tender (includes items, lines, assumptions).
   *
   * @returns the estimate, or null when none has been created yet
   * @throws NotFoundException when the tender does not exist
   */
  @Get("tenders/:tenderId/estimate")
  @RequirePermissions("estimates.view")
  @ApiOperation({ summary: "Get the estimate for a tender (includes items, lines, assumptions)" })
  @ApiResponse({ status: 200, description: "Tender estimate or null if none exists yet." })
  getEstimate(@Param("tenderId") tenderId: string) {
    return this.service.getEstimate(tenderId);
  }

  /**
   * Create the estimate for a tender (idempotent).
   *
   * @returns the existing estimate when present, otherwise a new one with 30% default markup
   * @throws NotFoundException when the tender does not exist
   */
  @Post("tenders/:tenderId/estimate")
  @RequirePermissions("estimates.manage")
  @ApiOperation({ summary: "Create the estimate for a tender (idempotent)" })
  @ApiResponse({ status: 201, description: "Estimate created or returned if already present." })
  createEstimate(@Param("tenderId") tenderId: string, @CurrentUser() actor: { sub: string }) {
    return this.service.createEstimate(tenderId, actor.sub);
  }

  /**
   * Update estimate-level fields (markup, notes).
   *
   * Upsert behaviour: if no estimate exists yet, one is created on the
   * fly with the patched values.
   *
   * @param dto - optional markup and notes
   * @returns the full refreshed estimate
   * @throws NotFoundException when the tender does not exist
   * @throws ForbiddenException when the estimate is locked
   */
  @Patch("tenders/:tenderId/estimate")
  @RequirePermissions("estimates.manage")
  @ApiOperation({ summary: "Update estimate-level fields (markup, notes)" })
  @ApiResponse({ status: 200, description: "Update estimate-level fields (markup, notes)." })
  updateEstimate(
    @Param("tenderId") tenderId: string,
    @Body() dto: UpdateEstimateDto,
    @CurrentUser() actor: { sub: string }
  ) {
    return this.service.updateEstimate(tenderId, dto, actor.sub);
  }

  /**
   * Lock an estimate (prevents further edits; typically after submission).
   *
   * @returns the estimate with lockedAt/lockedById set
   * @throws NotFoundException when the estimate does not exist
   */
  @Post("tenders/:tenderId/estimate/lock")
  @RequirePermissions("estimates.manage")
  @ApiOperation({ summary: "Lock an estimate (prevents further edits; typically after submission)" })
  @ApiResponse({ status: 201, description: "Lock an estimate (prevents further edits; typically after submission)." })
  lockEstimate(@Param("tenderId") tenderId: string, @CurrentUser() actor: { sub: string }) {
    return this.service.lockEstimate(tenderId, actor.sub);
  }

  /**
   * Unlock an estimate (admin only).
   *
   * @returns the estimate with lock fields cleared
   * @throws NotFoundException when the estimate does not exist
   */
  @Post("tenders/:tenderId/estimate/unlock")
  @RequirePermissions("estimates.admin")
  @ApiOperation({ summary: "Unlock an estimate (admin only)" })
  @ApiResponse({ status: 201, description: "Unlock an estimate (admin only)." })
  unlockEstimate(@Param("tenderId") tenderId: string, @CurrentUser() actor: { sub: string }) {
    return this.service.unlockEstimate(tenderId, actor.sub);
  }

  /**
   * Server-authoritative totals for the tender estimate.
   *
   * @returns per-item and overall totals `{ labour, equip, plant, waste, cutting, subtotal, price }` plus markupAmount; zeroed shape when no estimate exists
   * @throws NotFoundException when the tender does not exist
   */
  @Get("tenders/:tenderId/estimate/summary")
  @RequirePermissions("estimates.view")
  @ApiOperation({ summary: "Server-authoritative totals for the tender estimate" })
  @ApiResponse({
    status: 200,
    description: "Per-item and overall totals ({ labour, plant, waste, cutting, subtotal, price }) with markupAmount."
  })
  summary(@Param("tenderId") tenderId: string) {
    return this.service.summary(tenderId);
  }

  // ──────────────────────────────────────────────────────────────
  //  Items
  // ──────────────────────────────────────────────────────────────

  /**
   * Add a scope item to the estimate.
   *
   * @param dto - code, title, markup and provisional-sum fields
   * @returns the full refreshed estimate
   * @throws NotFoundException when the estimate does not exist
   * @throws ForbiddenException when the estimate is locked
   */
  @Post("tenders/:tenderId/estimate/items")
  @RequirePermissions("estimates.manage")
  @ApiOperation({ summary: "Add a scope item to the estimate" })
  @ApiResponse({ status: 201, description: "Add a scope item to the estimate." })
  addItem(
    @Param("tenderId") tenderId: string,
    @Body() dto: UpsertEstimateItemDto,
    @CurrentUser() actor: { sub: string }
  ) {
    return this.service.addItem(tenderId, dto, actor.sub);
  }

  /**
   * Update a scope item.
   *
   * @returns the full refreshed estimate
   * @throws NotFoundException when the estimate or item does not exist
   * @throws ForbiddenException when the estimate is locked
   */
  @Patch("tenders/:tenderId/estimate/items/:itemId")
  @RequirePermissions("estimates.manage")
  @ApiOperation({ summary: "Update a scope item" })
  @ApiResponse({ status: 200, description: "Update a scope item." })
  updateItem(
    @Param("tenderId") tenderId: string,
    @Param("itemId") itemId: string,
    @Body() dto: UpdateEstimateItemDto,
    @CurrentUser() actor: { sub: string }
  ) {
    return this.service.updateItem(tenderId, itemId, dto, actor.sub);
  }

  /**
   * Delete a scope item (cascades to lines and assumptions).
   *
   * @returns the full refreshed estimate
   * @throws NotFoundException when the estimate or item does not exist
   * @throws ForbiddenException when the estimate is locked
   */
  @Delete("tenders/:tenderId/estimate/items/:itemId")
  @RequirePermissions("estimates.manage")
  @ApiOperation({ summary: "Delete a scope item (cascades to lines and assumptions)" })
  @ApiResponse({ status: 200, description: "Delete a scope item (cascades to lines and assumptions)." })
  deleteItem(
    @Param("tenderId") tenderId: string,
    @Param("itemId") itemId: string,
    @CurrentUser() actor: { sub: string }
  ) {
    return this.service.deleteItem(tenderId, itemId, actor.sub);
  }

  // ──────────────────────────────────────────────────────────────
  //  Labour lines
  // ──────────────────────────────────────────────────────────────

  /**
   * Add a labour line to a scope item.
   *
   * @returns the full refreshed estimate
   * @throws NotFoundException when the estimate or item does not exist
   * @throws ForbiddenException when the estimate is locked
   */
  @Post("tenders/:tenderId/estimate/items/:itemId/labour")
  @RequirePermissions("estimates.manage")
  @ApiOperation({ summary: "Add a labour line to a scope item" })
  @ApiResponse({ status: 201, description: "Add a labour line to a scope item." })
  addLabourLine(
    @Param("tenderId") tenderId: string,
    @Param("itemId") itemId: string,
    @Body() dto: UpsertLabourLineDto,
    @CurrentUser() actor: { sub: string }
  ) {
    return this.service.addLabourLine(tenderId, itemId, dto, actor.sub);
  }

  /**
   * Update a labour line.
   *
   * @returns the full refreshed estimate
   * @throws NotFoundException when the estimate, item or line does not exist
   * @throws ForbiddenException when the estimate is locked
   */
  @Patch("tenders/:tenderId/estimate/items/:itemId/labour/:lineId")
  @RequirePermissions("estimates.manage")
  @ApiOperation({ summary: "Update a labour line" })
  @ApiResponse({ status: 200, description: "Update a labour line." })
  updateLabourLine(
    @Param("tenderId") tenderId: string,
    @Param("itemId") itemId: string,
    @Param("lineId") lineId: string,
    @Body() dto: UpdateLabourLineDto,
    @CurrentUser() actor: { sub: string }
  ) {
    return this.service.updateLabourLine(tenderId, itemId, lineId, dto, actor.sub);
  }

  /**
   * Delete a labour line.
   *
   * @returns the full refreshed estimate
   * @throws NotFoundException when the estimate, item or line does not exist
   * @throws ForbiddenException when the estimate is locked
   */
  @Delete("tenders/:tenderId/estimate/items/:itemId/labour/:lineId")
  @RequirePermissions("estimates.manage")
  @ApiOperation({ summary: "Delete a labour line" })
  @ApiResponse({ status: 200, description: "Delete a labour line." })
  deleteLabourLine(
    @Param("tenderId") tenderId: string,
    @Param("itemId") itemId: string,
    @Param("lineId") lineId: string,
    @CurrentUser() actor: { sub: string }
  ) {
    return this.service.deleteLabourLine(tenderId, itemId, lineId, actor.sub);
  }

  // ──────────────────────────────────────────────────────────────
  //  Plant lines
  // ──────────────────────────────────────────────────────────────

  /**
   * Add a plant line to a scope item.
   *
   * @returns the full refreshed estimate
   * @throws NotFoundException when the estimate or item does not exist
   * @throws ForbiddenException when the estimate is locked
   */
  @Post("tenders/:tenderId/estimate/items/:itemId/plant")
  @RequirePermissions("estimates.manage")
  @ApiOperation({ summary: "Add a plant line to a scope item" })
  @ApiResponse({ status: 201, description: "Add a plant line to a scope item." })
  addPlantLine(
    @Param("tenderId") tenderId: string,
    @Param("itemId") itemId: string,
    @Body() dto: UpsertPlantLineDto,
    @CurrentUser() actor: { sub: string }
  ) {
    return this.service.addPlantLine(tenderId, itemId, dto, actor.sub);
  }

  /**
   * Update a plant line.
   *
   * @returns the full refreshed estimate
   * @throws NotFoundException when the estimate, item or line does not exist
   * @throws ForbiddenException when the estimate is locked
   */
  @Patch("tenders/:tenderId/estimate/items/:itemId/plant/:lineId")
  @RequirePermissions("estimates.manage")
  @ApiOperation({ summary: "Update a plant line" })
  @ApiResponse({ status: 200, description: "Update a plant line." })
  updatePlantLine(
    @Param("tenderId") tenderId: string,
    @Param("itemId") itemId: string,
    @Param("lineId") lineId: string,
    @Body() dto: UpdatePlantLineDto,
    @CurrentUser() actor: { sub: string }
  ) {
    return this.service.updatePlantLine(tenderId, itemId, lineId, dto, actor.sub);
  }

  /**
   * Delete a plant line.
   *
   * @returns the full refreshed estimate
   * @throws NotFoundException when the estimate, item or line does not exist
   * @throws ForbiddenException when the estimate is locked
   */
  @Delete("tenders/:tenderId/estimate/items/:itemId/plant/:lineId")
  @RequirePermissions("estimates.manage")
  @ApiOperation({ summary: "Delete a plant line" })
  @ApiResponse({ status: 200, description: "Delete a plant line." })
  deletePlantLine(
    @Param("tenderId") tenderId: string,
    @Param("itemId") itemId: string,
    @Param("lineId") lineId: string,
    @CurrentUser() actor: { sub: string }
  ) {
    return this.service.deletePlantLine(tenderId, itemId, lineId, actor.sub);
  }

  // ──────────────────────────────────────────────────────────────
  //  Equipment hire & subcontractor lines
  // ──────────────────────────────────────────────────────────────

  /**
   * Add an equipment/subcontractor line to a scope item.
   *
   * @returns the full refreshed estimate
   * @throws NotFoundException when the estimate or item does not exist
   * @throws ForbiddenException when the estimate is locked
   */
  @Post("tenders/:tenderId/estimate/items/:itemId/equip")
  @RequirePermissions("estimates.manage")
  @ApiOperation({ summary: "Add an equipment/subcontractor line to a scope item" })
  @ApiResponse({ status: 201, description: "Add an equipment/subcontractor line to a scope item." })
  addEquipLine(
    @Param("tenderId") tenderId: string,
    @Param("itemId") itemId: string,
    @Body() dto: UpsertEquipLineDto,
    @CurrentUser() actor: { sub: string }
  ) {
    return this.service.addEquipLine(tenderId, itemId, dto, actor.sub);
  }

  /**
   * Update an equipment/subcontractor line.
   *
   * @returns the full refreshed estimate
   * @throws NotFoundException when the estimate, item or line does not exist
   * @throws ForbiddenException when the estimate is locked
   */
  @Patch("tenders/:tenderId/estimate/items/:itemId/equip/:lineId")
  @RequirePermissions("estimates.manage")
  @ApiOperation({ summary: "Update an equipment/subcontractor line" })
  @ApiResponse({ status: 200, description: "Update an equipment/subcontractor line." })
  updateEquipLine(
    @Param("tenderId") tenderId: string,
    @Param("itemId") itemId: string,
    @Param("lineId") lineId: string,
    @Body() dto: UpdateEquipLineDto,
    @CurrentUser() actor: { sub: string }
  ) {
    return this.service.updateEquipLine(tenderId, itemId, lineId, dto, actor.sub);
  }

  /**
   * Delete an equipment/subcontractor line.
   *
   * @returns the full refreshed estimate
   * @throws NotFoundException when the estimate, item or line does not exist
   * @throws ForbiddenException when the estimate is locked
   */
  @Delete("tenders/:tenderId/estimate/items/:itemId/equip/:lineId")
  @RequirePermissions("estimates.manage")
  @ApiOperation({ summary: "Delete an equipment/subcontractor line" })
  @ApiResponse({ status: 200, description: "Delete an equipment/subcontractor line." })
  deleteEquipLine(
    @Param("tenderId") tenderId: string,
    @Param("itemId") itemId: string,
    @Param("lineId") lineId: string,
    @CurrentUser() actor: { sub: string }
  ) {
    return this.service.deleteEquipLine(tenderId, itemId, lineId, actor.sub);
  }

  // ──────────────────────────────────────────────────────────────
  //  Waste lines
  // ──────────────────────────────────────────────────────────────

  /**
   * Add a waste line to a scope item.
   *
   * @returns the full refreshed estimate
   * @throws NotFoundException when the estimate or item does not exist
   * @throws ForbiddenException when the estimate is locked
   */
  @Post("tenders/:tenderId/estimate/items/:itemId/waste")
  @RequirePermissions("estimates.manage")
  @ApiOperation({ summary: "Add a waste line to a scope item" })
  @ApiResponse({ status: 201, description: "Add a waste line to a scope item." })
  addWasteLine(
    @Param("tenderId") tenderId: string,
    @Param("itemId") itemId: string,
    @Body() dto: UpsertWasteLineDto,
    @CurrentUser() actor: { sub: string }
  ) {
    return this.service.addWasteLine(tenderId, itemId, dto, actor.sub);
  }

  /**
   * Update a waste line.
   *
   * @returns the full refreshed estimate
   * @throws NotFoundException when the estimate, item or line does not exist
   * @throws ForbiddenException when the estimate is locked
   */
  @Patch("tenders/:tenderId/estimate/items/:itemId/waste/:lineId")
  @RequirePermissions("estimates.manage")
  @ApiOperation({ summary: "Update a waste line" })
  @ApiResponse({ status: 200, description: "Update a waste line." })
  updateWasteLine(
    @Param("tenderId") tenderId: string,
    @Param("itemId") itemId: string,
    @Param("lineId") lineId: string,
    @Body() dto: UpdateWasteLineDto,
    @CurrentUser() actor: { sub: string }
  ) {
    return this.service.updateWasteLine(tenderId, itemId, lineId, dto, actor.sub);
  }

  /**
   * Delete a waste line.
   *
   * @returns the full refreshed estimate
   * @throws NotFoundException when the estimate, item or line does not exist
   * @throws ForbiddenException when the estimate is locked
   */
  @Delete("tenders/:tenderId/estimate/items/:itemId/waste/:lineId")
  @RequirePermissions("estimates.manage")
  @ApiOperation({ summary: "Delete a waste line" })
  @ApiResponse({ status: 200, description: "Delete a waste line." })
  deleteWasteLine(
    @Param("tenderId") tenderId: string,
    @Param("itemId") itemId: string,
    @Param("lineId") lineId: string,
    @CurrentUser() actor: { sub: string }
  ) {
    return this.service.deleteWasteLine(tenderId, itemId, lineId, actor.sub);
  }

  // ──────────────────────────────────────────────────────────────
  //  Cutting lines
  // ──────────────────────────────────────────────────────────────

  /**
   * Add a cutting line to a scope item.
   *
   * @returns the full refreshed estimate
   * @throws NotFoundException when the estimate or item does not exist
   * @throws ForbiddenException when the estimate is locked
   */
  @Post("tenders/:tenderId/estimate/items/:itemId/cutting")
  @RequirePermissions("estimates.manage")
  @ApiOperation({ summary: "Add a cutting line to a scope item" })
  @ApiResponse({ status: 201, description: "Add a cutting line to a scope item." })
  addCuttingLine(
    @Param("tenderId") tenderId: string,
    @Param("itemId") itemId: string,
    @Body() dto: UpsertCuttingLineDto,
    @CurrentUser() actor: { sub: string }
  ) {
    return this.service.addCuttingLine(tenderId, itemId, dto, actor.sub);
  }

  /**
   * Update a cutting line.
   *
   * @returns the full refreshed estimate
   * @throws NotFoundException when the estimate, item or line does not exist
   * @throws ForbiddenException when the estimate is locked
   */
  @Patch("tenders/:tenderId/estimate/items/:itemId/cutting/:lineId")
  @RequirePermissions("estimates.manage")
  @ApiOperation({ summary: "Update a cutting line" })
  @ApiResponse({ status: 200, description: "Update a cutting line." })
  updateCuttingLine(
    @Param("tenderId") tenderId: string,
    @Param("itemId") itemId: string,
    @Param("lineId") lineId: string,
    @Body() dto: UpdateCuttingLineDto,
    @CurrentUser() actor: { sub: string }
  ) {
    return this.service.updateCuttingLine(tenderId, itemId, lineId, dto, actor.sub);
  }

  /**
   * Delete a cutting line.
   *
   * @returns the full refreshed estimate
   * @throws NotFoundException when the estimate, item or line does not exist
   * @throws ForbiddenException when the estimate is locked
   */
  @Delete("tenders/:tenderId/estimate/items/:itemId/cutting/:lineId")
  @RequirePermissions("estimates.manage")
  @ApiOperation({ summary: "Delete a cutting line" })
  @ApiResponse({ status: 200, description: "Delete a cutting line." })
  deleteCuttingLine(
    @Param("tenderId") tenderId: string,
    @Param("itemId") itemId: string,
    @Param("lineId") lineId: string,
    @CurrentUser() actor: { sub: string }
  ) {
    return this.service.deleteCuttingLine(tenderId, itemId, lineId, actor.sub);
  }

  // ──────────────────────────────────────────────────────────────
  //  Assumptions
  // ──────────────────────────────────────────────────────────────

  /**
   * Add an assumption to a scope item.
   *
   * @returns the full refreshed estimate
   * @throws NotFoundException when the estimate or item does not exist
   * @throws ForbiddenException when the estimate is locked
   */
  @Post("tenders/:tenderId/estimate/items/:itemId/assumptions")
  @RequirePermissions("estimates.manage")
  @ApiOperation({ summary: "Add an assumption to a scope item" })
  @ApiResponse({ status: 201, description: "Add an assumption to a scope item." })
  addAssumption(
    @Param("tenderId") tenderId: string,
    @Param("itemId") itemId: string,
    @Body() dto: UpsertAssumptionDto,
    @CurrentUser() actor: { sub: string }
  ) {
    return this.service.addAssumption(tenderId, itemId, dto, actor.sub);
  }

  /**
   * Update an assumption.
   *
   * @returns the full refreshed estimate
   * @throws NotFoundException when the estimate, item or assumption does not exist
   * @throws ForbiddenException when the estimate is locked
   */
  @Patch("tenders/:tenderId/estimate/items/:itemId/assumptions/:lineId")
  @RequirePermissions("estimates.manage")
  @ApiOperation({ summary: "Update an assumption" })
  @ApiResponse({ status: 200, description: "Update an assumption." })
  updateAssumption(
    @Param("tenderId") tenderId: string,
    @Param("itemId") itemId: string,
    @Param("lineId") lineId: string,
    @Body() dto: UpdateAssumptionDto,
    @CurrentUser() actor: { sub: string }
  ) {
    return this.service.updateAssumption(tenderId, itemId, lineId, dto, actor.sub);
  }

  /**
   * Delete an assumption.
   *
   * @returns the full refreshed estimate
   * @throws NotFoundException when the estimate, item or assumption does not exist
   * @throws ForbiddenException when the estimate is locked
   */
  @Delete("tenders/:tenderId/estimate/items/:itemId/assumptions/:lineId")
  @RequirePermissions("estimates.manage")
  @ApiOperation({ summary: "Delete an assumption" })
  @ApiResponse({ status: 200, description: "Delete an assumption." })
  deleteAssumption(
    @Param("tenderId") tenderId: string,
    @Param("itemId") itemId: string,
    @Param("lineId") lineId: string,
    @CurrentUser() actor: { sub: string }
  ) {
    return this.service.deleteAssumption(tenderId, itemId, lineId, actor.sub);
  }
}
