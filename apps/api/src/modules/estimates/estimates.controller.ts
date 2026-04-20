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
  UpsertCuttingLineDto,
  UpsertCuttingRateDto,
  UpsertEnclosureRateDto,
  UpsertEquipLineDto,
  UpsertEstimateItemDto,
  UpsertFuelRateDto,
  UpsertLabourLineDto,
  UpsertLabourRateDto,
  UpsertPlantLineDto,
  UpsertPlantRateDto,
  UpsertWasteLineDto,
  UpsertWasteRateDto
} from "./dto/estimates.dto";
import { EstimatesService } from "./estimates.service";

@ApiTags("Estimates")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller()
export class EstimatesController {
  constructor(private readonly service: EstimatesService) {}

  // ──────────────────────────────────────────────────────────────
  //  Rate library — labour
  // ──────────────────────────────────────────────────────────────

  @Get("estimate-rates/labour")
  @RequirePermissions("estimates.view")
  @ApiOperation({ summary: "List labour rates (rate library)" })
  @ApiResponse({ status: 200, description: "Ordered list of labour rates." })
  listLabourRates() {
    return this.service.listLabourRates();
  }

  @Post("estimate-rates/labour")
  @RequirePermissions("estimates.admin")
  @ApiOperation({ summary: "Create a labour rate" })
  @ApiResponse({ status: 201, description: "Labour rate created." })
  createLabourRate(@Body() dto: UpsertLabourRateDto, @CurrentUser() actor: { sub: string }) {
    return this.service.upsertLabourRate(undefined, dto, actor.sub);
  }

  @Patch("estimate-rates/labour/:id")
  @RequirePermissions("estimates.admin")
  @ApiOperation({ summary: "Update a labour rate" })
  @ApiResponse({ status: 200, description: "Labour rate updated." })
  updateLabourRate(@Param("id") id: string, @Body() dto: UpsertLabourRateDto, @CurrentUser() actor: { sub: string }) {
    return this.service.upsertLabourRate(id, dto, actor.sub);
  }

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

  @Get("estimate-rates/plant")
  @RequirePermissions("estimates.view")
  @ApiOperation({ summary: "List plant rates (rate library)" })
  listPlantRates() {
    return this.service.listPlantRates();
  }

  @Post("estimate-rates/plant")
  @RequirePermissions("estimates.admin")
  @ApiOperation({ summary: "Create a plant rate" })
  createPlantRate(@Body() dto: UpsertPlantRateDto, @CurrentUser() actor: { sub: string }) {
    return this.service.upsertPlantRate(undefined, dto, actor.sub);
  }

  @Patch("estimate-rates/plant/:id")
  @RequirePermissions("estimates.admin")
  @ApiOperation({ summary: "Update a plant rate" })
  updatePlantRate(@Param("id") id: string, @Body() dto: UpsertPlantRateDto, @CurrentUser() actor: { sub: string }) {
    return this.service.upsertPlantRate(id, dto, actor.sub);
  }

  @Delete("estimate-rates/plant/:id")
  @RequirePermissions("estimates.admin")
  @ApiOperation({ summary: "Delete a plant rate" })
  deletePlantRate(@Param("id") id: string, @CurrentUser() actor: { sub: string }) {
    return this.service.deletePlantRate(id, actor.sub);
  }

  // ──────────────────────────────────────────────────────────────
  //  Rate library — waste
  // ──────────────────────────────────────────────────────────────

  @Get("estimate-rates/waste")
  @RequirePermissions("estimates.view")
  @ApiOperation({ summary: "List waste rates (rate library)" })
  listWasteRates() {
    return this.service.listWasteRates();
  }

  @Post("estimate-rates/waste")
  @RequirePermissions("estimates.admin")
  @ApiOperation({ summary: "Create a waste rate" })
  createWasteRate(@Body() dto: UpsertWasteRateDto, @CurrentUser() actor: { sub: string }) {
    return this.service.upsertWasteRate(undefined, dto, actor.sub);
  }

  @Patch("estimate-rates/waste/:id")
  @RequirePermissions("estimates.admin")
  @ApiOperation({ summary: "Update a waste rate" })
  updateWasteRate(@Param("id") id: string, @Body() dto: UpsertWasteRateDto, @CurrentUser() actor: { sub: string }) {
    return this.service.upsertWasteRate(id, dto, actor.sub);
  }

  @Delete("estimate-rates/waste/:id")
  @RequirePermissions("estimates.admin")
  @ApiOperation({ summary: "Delete a waste rate" })
  deleteWasteRate(@Param("id") id: string, @CurrentUser() actor: { sub: string }) {
    return this.service.deleteWasteRate(id, actor.sub);
  }

  // ──────────────────────────────────────────────────────────────
  //  Rate library — cutting
  // ──────────────────────────────────────────────────────────────

  @Get("estimate-rates/cutting")
  @RequirePermissions("estimates.view")
  @ApiOperation({ summary: "List cutting rates (rate library)" })
  listCuttingRates() {
    return this.service.listCuttingRates();
  }

  @Post("estimate-rates/cutting")
  @RequirePermissions("estimates.admin")
  @ApiOperation({ summary: "Create a cutting rate" })
  createCuttingRate(@Body() dto: UpsertCuttingRateDto, @CurrentUser() actor: { sub: string }) {
    return this.service.upsertCuttingRate(undefined, dto, actor.sub);
  }

  @Patch("estimate-rates/cutting/:id")
  @RequirePermissions("estimates.admin")
  @ApiOperation({ summary: "Update a cutting rate" })
  updateCuttingRate(@Param("id") id: string, @Body() dto: UpsertCuttingRateDto, @CurrentUser() actor: { sub: string }) {
    return this.service.upsertCuttingRate(id, dto, actor.sub);
  }

  @Delete("estimate-rates/cutting/:id")
  @RequirePermissions("estimates.admin")
  @ApiOperation({ summary: "Delete a cutting rate" })
  deleteCuttingRate(@Param("id") id: string, @CurrentUser() actor: { sub: string }) {
    return this.service.deleteCuttingRate(id, actor.sub);
  }

  // ──────────────────────────────────────────────────────────────
  //  Rate library — fuel
  // ──────────────────────────────────────────────────────────────

  @Get("estimate-rates/fuel")
  @RequirePermissions("estimates.view")
  @ApiOperation({ summary: "List fuel rates (rate library)" })
  listFuelRates() {
    return this.service.listFuelRates();
  }

  @Post("estimate-rates/fuel")
  @RequirePermissions("estimates.admin")
  @ApiOperation({ summary: "Create a fuel rate" })
  createFuelRate(@Body() dto: UpsertFuelRateDto, @CurrentUser() actor: { sub: string }) {
    return this.service.upsertFuelRate(undefined, dto, actor.sub);
  }

  @Patch("estimate-rates/fuel/:id")
  @RequirePermissions("estimates.admin")
  @ApiOperation({ summary: "Update a fuel rate" })
  updateFuelRate(@Param("id") id: string, @Body() dto: UpsertFuelRateDto, @CurrentUser() actor: { sub: string }) {
    return this.service.upsertFuelRate(id, dto, actor.sub);
  }

  @Delete("estimate-rates/fuel/:id")
  @RequirePermissions("estimates.admin")
  @ApiOperation({ summary: "Delete a fuel rate" })
  deleteFuelRate(@Param("id") id: string, @CurrentUser() actor: { sub: string }) {
    return this.service.deleteFuelRate(id, actor.sub);
  }

  // ──────────────────────────────────────────────────────────────
  //  Rate library — enclosure
  // ──────────────────────────────────────────────────────────────

  @Get("estimate-rates/enclosure")
  @RequirePermissions("estimates.view")
  @ApiOperation({ summary: "List asbestos enclosure rates (rate library)" })
  listEnclosureRates() {
    return this.service.listEnclosureRates();
  }

  @Post("estimate-rates/enclosure")
  @RequirePermissions("estimates.admin")
  @ApiOperation({ summary: "Create an enclosure rate" })
  createEnclosureRate(@Body() dto: UpsertEnclosureRateDto, @CurrentUser() actor: { sub: string }) {
    return this.service.upsertEnclosureRate(undefined, dto, actor.sub);
  }

  @Patch("estimate-rates/enclosure/:id")
  @RequirePermissions("estimates.admin")
  @ApiOperation({ summary: "Update an enclosure rate" })
  updateEnclosureRate(@Param("id") id: string, @Body() dto: UpsertEnclosureRateDto, @CurrentUser() actor: { sub: string }) {
    return this.service.upsertEnclosureRate(id, dto, actor.sub);
  }

  @Delete("estimate-rates/enclosure/:id")
  @RequirePermissions("estimates.admin")
  @ApiOperation({ summary: "Delete an enclosure rate" })
  deleteEnclosureRate(@Param("id") id: string, @CurrentUser() actor: { sub: string }) {
    return this.service.deleteEnclosureRate(id, actor.sub);
  }

  // ──────────────────────────────────────────────────────────────
  //  Estimate lifecycle (one per tender)
  // ──────────────────────────────────────────────────────────────

  @Get("tenders/:tenderId/estimate")
  @RequirePermissions("estimates.view")
  @ApiOperation({ summary: "Get the estimate for a tender (includes items, lines, assumptions)" })
  @ApiResponse({ status: 200, description: "Tender estimate or null if none exists yet." })
  getEstimate(@Param("tenderId") tenderId: string) {
    return this.service.getEstimate(tenderId);
  }

  @Post("tenders/:tenderId/estimate")
  @RequirePermissions("estimates.manage")
  @ApiOperation({ summary: "Create the estimate for a tender (idempotent)" })
  @ApiResponse({ status: 201, description: "Estimate created or returned if already present." })
  createEstimate(@Param("tenderId") tenderId: string, @CurrentUser() actor: { sub: string }) {
    return this.service.createEstimate(tenderId, actor.sub);
  }

  @Patch("tenders/:tenderId/estimate")
  @RequirePermissions("estimates.manage")
  @ApiOperation({ summary: "Update estimate-level fields (markup, notes)" })
  updateEstimate(
    @Param("tenderId") tenderId: string,
    @Body() dto: UpdateEstimateDto,
    @CurrentUser() actor: { sub: string }
  ) {
    return this.service.updateEstimate(tenderId, dto, actor.sub);
  }

  @Post("tenders/:tenderId/estimate/lock")
  @RequirePermissions("estimates.manage")
  @ApiOperation({ summary: "Lock an estimate (prevents further edits; typically after submission)" })
  lockEstimate(@Param("tenderId") tenderId: string, @CurrentUser() actor: { sub: string }) {
    return this.service.lockEstimate(tenderId, actor.sub);
  }

  @Post("tenders/:tenderId/estimate/unlock")
  @RequirePermissions("estimates.admin")
  @ApiOperation({ summary: "Unlock an estimate (admin only)" })
  unlockEstimate(@Param("tenderId") tenderId: string, @CurrentUser() actor: { sub: string }) {
    return this.service.unlockEstimate(tenderId, actor.sub);
  }

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

  @Post("tenders/:tenderId/estimate/items")
  @RequirePermissions("estimates.manage")
  @ApiOperation({ summary: "Add a scope item to the estimate" })
  addItem(
    @Param("tenderId") tenderId: string,
    @Body() dto: UpsertEstimateItemDto,
    @CurrentUser() actor: { sub: string }
  ) {
    return this.service.addItem(tenderId, dto, actor.sub);
  }

  @Patch("tenders/:tenderId/estimate/items/:itemId")
  @RequirePermissions("estimates.manage")
  @ApiOperation({ summary: "Update a scope item" })
  updateItem(
    @Param("tenderId") tenderId: string,
    @Param("itemId") itemId: string,
    @Body() dto: UpdateEstimateItemDto,
    @CurrentUser() actor: { sub: string }
  ) {
    return this.service.updateItem(tenderId, itemId, dto, actor.sub);
  }

  @Delete("tenders/:tenderId/estimate/items/:itemId")
  @RequirePermissions("estimates.manage")
  @ApiOperation({ summary: "Delete a scope item (cascades to lines and assumptions)" })
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

  @Post("tenders/:tenderId/estimate/items/:itemId/labour")
  @RequirePermissions("estimates.manage")
  @ApiOperation({ summary: "Add a labour line to a scope item" })
  addLabourLine(
    @Param("tenderId") tenderId: string,
    @Param("itemId") itemId: string,
    @Body() dto: UpsertLabourLineDto,
    @CurrentUser() actor: { sub: string }
  ) {
    return this.service.addLabourLine(tenderId, itemId, dto, actor.sub);
  }

  @Patch("tenders/:tenderId/estimate/items/:itemId/labour/:lineId")
  @RequirePermissions("estimates.manage")
  @ApiOperation({ summary: "Update a labour line" })
  updateLabourLine(
    @Param("tenderId") tenderId: string,
    @Param("itemId") itemId: string,
    @Param("lineId") lineId: string,
    @Body() dto: UpdateLabourLineDto,
    @CurrentUser() actor: { sub: string }
  ) {
    return this.service.updateLabourLine(tenderId, itemId, lineId, dto, actor.sub);
  }

  @Delete("tenders/:tenderId/estimate/items/:itemId/labour/:lineId")
  @RequirePermissions("estimates.manage")
  @ApiOperation({ summary: "Delete a labour line" })
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

  @Post("tenders/:tenderId/estimate/items/:itemId/plant")
  @RequirePermissions("estimates.manage")
  @ApiOperation({ summary: "Add a plant line to a scope item" })
  addPlantLine(
    @Param("tenderId") tenderId: string,
    @Param("itemId") itemId: string,
    @Body() dto: UpsertPlantLineDto,
    @CurrentUser() actor: { sub: string }
  ) {
    return this.service.addPlantLine(tenderId, itemId, dto, actor.sub);
  }

  @Patch("tenders/:tenderId/estimate/items/:itemId/plant/:lineId")
  @RequirePermissions("estimates.manage")
  @ApiOperation({ summary: "Update a plant line" })
  updatePlantLine(
    @Param("tenderId") tenderId: string,
    @Param("itemId") itemId: string,
    @Param("lineId") lineId: string,
    @Body() dto: UpdatePlantLineDto,
    @CurrentUser() actor: { sub: string }
  ) {
    return this.service.updatePlantLine(tenderId, itemId, lineId, dto, actor.sub);
  }

  @Delete("tenders/:tenderId/estimate/items/:itemId/plant/:lineId")
  @RequirePermissions("estimates.manage")
  @ApiOperation({ summary: "Delete a plant line" })
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

  @Post("tenders/:tenderId/estimate/items/:itemId/equip")
  @RequirePermissions("estimates.manage")
  @ApiOperation({ summary: "Add an equipment/subcontractor line to a scope item" })
  addEquipLine(
    @Param("tenderId") tenderId: string,
    @Param("itemId") itemId: string,
    @Body() dto: UpsertEquipLineDto,
    @CurrentUser() actor: { sub: string }
  ) {
    return this.service.addEquipLine(tenderId, itemId, dto, actor.sub);
  }

  @Patch("tenders/:tenderId/estimate/items/:itemId/equip/:lineId")
  @RequirePermissions("estimates.manage")
  @ApiOperation({ summary: "Update an equipment/subcontractor line" })
  updateEquipLine(
    @Param("tenderId") tenderId: string,
    @Param("itemId") itemId: string,
    @Param("lineId") lineId: string,
    @Body() dto: UpdateEquipLineDto,
    @CurrentUser() actor: { sub: string }
  ) {
    return this.service.updateEquipLine(tenderId, itemId, lineId, dto, actor.sub);
  }

  @Delete("tenders/:tenderId/estimate/items/:itemId/equip/:lineId")
  @RequirePermissions("estimates.manage")
  @ApiOperation({ summary: "Delete an equipment/subcontractor line" })
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

  @Post("tenders/:tenderId/estimate/items/:itemId/waste")
  @RequirePermissions("estimates.manage")
  @ApiOperation({ summary: "Add a waste line to a scope item" })
  addWasteLine(
    @Param("tenderId") tenderId: string,
    @Param("itemId") itemId: string,
    @Body() dto: UpsertWasteLineDto,
    @CurrentUser() actor: { sub: string }
  ) {
    return this.service.addWasteLine(tenderId, itemId, dto, actor.sub);
  }

  @Patch("tenders/:tenderId/estimate/items/:itemId/waste/:lineId")
  @RequirePermissions("estimates.manage")
  @ApiOperation({ summary: "Update a waste line" })
  updateWasteLine(
    @Param("tenderId") tenderId: string,
    @Param("itemId") itemId: string,
    @Param("lineId") lineId: string,
    @Body() dto: UpdateWasteLineDto,
    @CurrentUser() actor: { sub: string }
  ) {
    return this.service.updateWasteLine(tenderId, itemId, lineId, dto, actor.sub);
  }

  @Delete("tenders/:tenderId/estimate/items/:itemId/waste/:lineId")
  @RequirePermissions("estimates.manage")
  @ApiOperation({ summary: "Delete a waste line" })
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

  @Post("tenders/:tenderId/estimate/items/:itemId/cutting")
  @RequirePermissions("estimates.manage")
  @ApiOperation({ summary: "Add a cutting line to a scope item" })
  addCuttingLine(
    @Param("tenderId") tenderId: string,
    @Param("itemId") itemId: string,
    @Body() dto: UpsertCuttingLineDto,
    @CurrentUser() actor: { sub: string }
  ) {
    return this.service.addCuttingLine(tenderId, itemId, dto, actor.sub);
  }

  @Patch("tenders/:tenderId/estimate/items/:itemId/cutting/:lineId")
  @RequirePermissions("estimates.manage")
  @ApiOperation({ summary: "Update a cutting line" })
  updateCuttingLine(
    @Param("tenderId") tenderId: string,
    @Param("itemId") itemId: string,
    @Param("lineId") lineId: string,
    @Body() dto: UpdateCuttingLineDto,
    @CurrentUser() actor: { sub: string }
  ) {
    return this.service.updateCuttingLine(tenderId, itemId, lineId, dto, actor.sub);
  }

  @Delete("tenders/:tenderId/estimate/items/:itemId/cutting/:lineId")
  @RequirePermissions("estimates.manage")
  @ApiOperation({ summary: "Delete a cutting line" })
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

  @Post("tenders/:tenderId/estimate/items/:itemId/assumptions")
  @RequirePermissions("estimates.manage")
  @ApiOperation({ summary: "Add an assumption to a scope item" })
  addAssumption(
    @Param("tenderId") tenderId: string,
    @Param("itemId") itemId: string,
    @Body() dto: UpsertAssumptionDto,
    @CurrentUser() actor: { sub: string }
  ) {
    return this.service.addAssumption(tenderId, itemId, dto, actor.sub);
  }

  @Patch("tenders/:tenderId/estimate/items/:itemId/assumptions/:lineId")
  @RequirePermissions("estimates.manage")
  @ApiOperation({ summary: "Update an assumption" })
  updateAssumption(
    @Param("tenderId") tenderId: string,
    @Param("itemId") itemId: string,
    @Param("lineId") lineId: string,
    @Body() dto: UpdateAssumptionDto,
    @CurrentUser() actor: { sub: string }
  ) {
    return this.service.updateAssumption(tenderId, itemId, lineId, dto, actor.sub);
  }

  @Delete("tenders/:tenderId/estimate/items/:itemId/assumptions/:lineId")
  @RequirePermissions("estimates.manage")
  @ApiOperation({ summary: "Delete an assumption" })
  deleteAssumption(
    @Param("tenderId") tenderId: string,
    @Param("itemId") itemId: string,
    @Param("lineId") lineId: string,
    @CurrentUser() actor: { sub: string }
  ) {
    return this.service.deleteAssumption(tenderId, itemId, lineId, actor.sub);
  }
}
