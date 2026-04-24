import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from "@nestjs/swagger";
import { IsArray, IsBoolean, IsIn, IsInt, IsNumber, IsOptional, IsString } from "class-validator";
import { Type } from "class-transformer";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { DirectoryService } from "./directory.service";

type AuthedRequest = { user?: { permissionCodes?: string[] } };

function hasPermission(req: AuthedRequest, code: string): boolean {
  return Array.isArray(req.user?.permissionCodes) && (req.user?.permissionCodes ?? []).includes(code);
}

class UpsertSubcontractorDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() tradingName?: string | null;
  @IsOptional() @IsString() businessType?: string;
  @IsOptional() @IsString() abn?: string | null;
  @IsOptional() @IsString() acn?: string | null;
  @IsOptional() @IsBoolean() gstRegistered?: boolean;
  @IsOptional() @IsString() website?: string | null;
  @IsOptional() @IsString() entityType?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) categories?: string[];
  @IsOptional() @IsString() prequalStatus?: string;
  @IsOptional() @IsString() prequalNotes?: string | null;
  @IsOptional() @IsBoolean() swmsOnFile?: boolean;
  @IsOptional() @IsString() email?: string | null;
  @IsOptional() @IsString() phone?: string | null;
  @IsOptional() @IsString() physicalAddress?: string | null;
  @IsOptional() @IsString() physicalSuburb?: string | null;
  @IsOptional() @IsString() physicalState?: string | null;
  @IsOptional() @IsString() physicalPostcode?: string | null;
  @IsOptional() @IsString() postalAddress?: string | null;
  @IsOptional() @IsString() postalSuburb?: string | null;
  @IsOptional() @IsString() postalState?: string | null;
  @IsOptional() @IsString() postalPostcode?: string | null;
  @IsOptional() @IsBoolean() postalSameAs?: boolean;
  @IsOptional() @Type(() => Number) @IsInt() paymentTermsDays?: number | null;
  @IsOptional() @Type(() => Number) @IsNumber() creditLimit?: number | null;
  @IsOptional() @IsBoolean() creditApproved?: boolean;
  @IsOptional() @IsString() preferredPayment?: string | null;
  @IsOptional() @IsString() bankName?: string | null;
  @IsOptional() @IsString() bankAccountName?: string | null;
  @IsOptional() @IsString() bankBsb?: string | null;
  @IsOptional() @IsString() bankAccountNumber?: string | null;
  @IsOptional() @IsString() xeroContactId?: string | null;
  @IsOptional() @IsString() myobCardId?: string | null;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsBoolean() onHold?: boolean;
  @IsOptional() @IsString() onHoldReason?: string | null;
  @IsOptional() @IsString() internalNotes?: string | null;
  @IsOptional() @Type(() => Number) @IsInt() performanceRating?: number | null;
}

class UpsertContactDto {
  @IsOptional() @IsString() firstName?: string;
  @IsOptional() @IsString() lastName?: string;
  @IsOptional() @IsString() role?: string | null;
  @IsOptional() @IsString() phone?: string | null;
  @IsOptional() @IsString() mobile?: string | null;
  @IsOptional() @IsString() email?: string | null;
  @IsOptional() @IsBoolean() isPrimary?: boolean;
  @IsOptional() @IsBoolean() hasPortalAccess?: boolean;
  @IsOptional() @IsString() notes?: string | null;
}

class UpsertLicenceDto {
  @IsOptional() @IsString() licenceType?: string;
  @IsOptional() @IsString() licenceNumber?: string | null;
  @IsOptional() @IsString() issuingAuthority?: string | null;
  @IsOptional() @IsString() issueDate?: string | null;
  @IsOptional() @IsString() expiryDate?: string | null;
  @IsOptional() @IsString() documentPath?: string | null;
  @IsOptional() @IsString() notes?: string | null;
  @IsOptional() @IsString() status?: string;
}

class UpsertInsuranceDto {
  @IsOptional() @IsString() insuranceType?: string;
  @IsOptional() @IsString() insurerName?: string | null;
  @IsOptional() @IsString() policyNumber?: string | null;
  @IsOptional() @Type(() => Number) @IsNumber() coverageAmount?: number | null;
  @IsOptional() @IsString() expiryDate?: string | null;
  @IsOptional() @IsString() documentPath?: string | null;
  @IsOptional() @IsString() notes?: string | null;
  @IsOptional() @IsString() status?: string;
}

class UpsertCreditApplicationDto {
  @IsOptional() @IsString() @IsIn(["outgoing", "incoming"]) direction?: string;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @Type(() => Number) @IsNumber() creditLimit?: number | null;
  @IsOptional() @Type(() => Number) @IsInt() paymentTerms?: number | null;
  @IsOptional() @IsString() applicationDate?: string | null;
  @IsOptional() @IsString() approvedDate?: string | null;
  @IsOptional() @IsString() rejectedDate?: string | null;
  @IsOptional() @IsString() notes?: string | null;
  @IsOptional() @IsString() documentPath?: string | null;
  @IsOptional() @IsString() accountNumber?: string | null;
}

class UpsertDocumentDto {
  @IsOptional() @IsString() documentType?: string;
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() filePath?: string | null;
  @IsOptional() @IsString() notes?: string | null;
}

class UpdatePrequalDto {
  @IsString() prequalStatus!: string;
  @IsOptional() @IsString() prequalNotes?: string | null;
}

@ApiTags("Directory")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller()
export class DirectoryController {
  constructor(private readonly service: DirectoryService) {}

  // ─── Subcontractor list / get / CRUD ────────────────────────────────────
  @Get("directory")
  @RequirePermissions("directory.view")
  @ApiOperation({ summary: "List subcontractors/suppliers with filters + expiry alerts count." })
  @ApiQuery({ name: "type", required: false })
  @ApiQuery({ name: "category", required: false })
  @ApiQuery({ name: "status", required: false })
  @ApiQuery({ name: "prequal", required: false })
  @ApiQuery({ name: "q", required: false })
  list(
    @Query("type") type?: string,
    @Query("category") category?: string,
    @Query("status") status?: string,
    @Query("prequal") prequal?: string,
    @Query("q") q?: string
  ) {
    return this.service.list({ type, category, status, prequal, q });
  }

  @Get("directory/expiry-alerts")
  @RequirePermissions("directory.view")
  @ApiOperation({ summary: "Licences + insurances expiring within 30 days or already expired." })
  @ApiResponse({ status: 200, description: "Alerts sorted by expiry (most urgent first)." })
  expiryAlerts() {
    return this.service.expiryAlerts();
  }

  @Get("directory/:id")
  @RequirePermissions("directory.view")
  @ApiOperation({ summary: "Full subcontractor record with contacts, licences, insurances, docs, credit apps." })
  get(@Param("id") id: string, @Req() req: AuthedRequest) {
    return this.service.get(id, hasPermission(req, "directory.finance"));
  }

  @Post("directory")
  @RequirePermissions("directory.manage")
  @ApiOperation({ summary: "Create a subcontractor/supplier entry. Auto-creates primary contact for private_person." })
  create(
    @Body() dto: UpsertSubcontractorDto,
    @CurrentUser() actor: { sub: string },
    @Req() req: AuthedRequest
  ) {
    return this.service.create(dto as never, actor.sub, hasPermission(req, "directory.finance"));
  }

  @Patch("directory/:id")
  @RequirePermissions("directory.manage")
  @ApiOperation({ summary: "Update subcontractor/supplier fields. Bank details require directory.finance." })
  update(@Param("id") id: string, @Body() dto: UpsertSubcontractorDto, @Req() req: AuthedRequest) {
    return this.service.update(id, dto as never, hasPermission(req, "directory.finance"));
  }

  @Delete("directory/:id")
  @RequirePermissions("directory.admin")
  @ApiOperation({ summary: "Soft-delete (set isActive=false)." })
  remove(@Param("id") id: string) {
    return this.service.softDelete(id);
  }

  @Patch("directory/:id/prequal")
  @RequirePermissions("directory.admin")
  @ApiOperation({ summary: "Update prequalification status + notes." })
  updatePrequal(
    @Param("id") id: string,
    @Body() dto: UpdatePrequalDto,
    @CurrentUser() actor: { sub: string }
  ) {
    return this.service.updatePrequal(id, actor.sub, dto);
  }

  // ─── Subcontractor contacts ─────────────────────────────────────────────
  @Post("directory/:id/contacts")
  @RequirePermissions("directory.manage")
  addContact(@Param("id") id: string, @Body() dto: UpsertContactDto) {
    return this.service.addContact(id, dto as never);
  }

  @Patch("directory/:id/contacts/:contactId")
  @RequirePermissions("directory.manage")
  patchContact(
    @Param("id") id: string,
    @Param("contactId") contactId: string,
    @Body() dto: UpsertContactDto
  ) {
    return this.service.updateContact(id, contactId, dto as never);
  }

  @Delete("directory/:id/contacts/:contactId")
  @RequirePermissions("directory.manage")
  deleteContact(@Param("id") id: string, @Param("contactId") contactId: string) {
    return this.service.deleteContact(id, contactId);
  }

  // ─── Subcontractor licences ─────────────────────────────────────────────
  @Post("directory/:id/licences")
  @RequirePermissions("directory.manage")
  addSubLicence(@Param("id") id: string, @Body() dto: UpsertLicenceDto) {
    return this.service.addLicence({ subcontractorId: id }, dto as never);
  }

  @Patch("directory/:id/licences/:licenceId")
  @RequirePermissions("directory.manage")
  patchSubLicence(
    @Param("id") id: string,
    @Param("licenceId") licenceId: string,
    @Body() dto: UpsertLicenceDto
  ) {
    return this.service.updateLicence({ subcontractorId: id }, licenceId, dto as never);
  }

  @Delete("directory/:id/licences/:licenceId")
  @RequirePermissions("directory.manage")
  deleteSubLicence(@Param("id") id: string, @Param("licenceId") licenceId: string) {
    return this.service.deleteLicence({ subcontractorId: id }, licenceId);
  }

  // ─── Subcontractor insurances ───────────────────────────────────────────
  @Post("directory/:id/insurances")
  @RequirePermissions("directory.manage")
  addSubInsurance(@Param("id") id: string, @Body() dto: UpsertInsuranceDto) {
    return this.service.addInsurance({ subcontractorId: id }, dto as never);
  }

  @Patch("directory/:id/insurances/:insuranceId")
  @RequirePermissions("directory.manage")
  patchSubInsurance(
    @Param("id") id: string,
    @Param("insuranceId") insuranceId: string,
    @Body() dto: UpsertInsuranceDto
  ) {
    return this.service.updateInsurance({ subcontractorId: id }, insuranceId, dto as never);
  }

  @Delete("directory/:id/insurances/:insuranceId")
  @RequirePermissions("directory.manage")
  deleteSubInsurance(@Param("id") id: string, @Param("insuranceId") insuranceId: string) {
    return this.service.deleteInsurance({ subcontractorId: id }, insuranceId);
  }

  // ─── Subcontractor credit applications ──────────────────────────────────
  @Post("directory/:id/credit-applications")
  @RequirePermissions("directory.manage")
  addSubCreditApp(
    @Param("id") id: string,
    @Body() dto: UpsertCreditApplicationDto,
    @CurrentUser() actor: { sub: string }
  ) {
    return this.service.addCreditApplication({ subcontractorId: id }, actor.sub, dto as never);
  }

  @Patch("directory/:id/credit-applications/:appId")
  @RequirePermissions("directory.manage")
  patchSubCreditApp(
    @Param("id") id: string,
    @Param("appId") appId: string,
    @Body() dto: UpsertCreditApplicationDto,
    @CurrentUser() actor: { sub: string },
    @Req() req: AuthedRequest
  ) {
    return this.service.updateCreditApplication(
      { subcontractorId: id },
      appId,
      actor.sub,
      dto as never,
      hasPermission(req, "directory.admin"),
      hasPermission(req, "finance.manage")
    );
  }

  // ─── Subcontractor documents ────────────────────────────────────────────
  @Post("directory/:id/documents")
  @RequirePermissions("directory.manage")
  addDoc(
    @Param("id") id: string,
    @Body() dto: UpsertDocumentDto,
    @CurrentUser() actor: { sub: string }
  ) {
    return this.service.addDocument(id, actor.sub, dto as never);
  }

  @Patch("directory/:id/documents/:docId")
  @RequirePermissions("directory.manage")
  patchDoc(
    @Param("id") id: string,
    @Param("docId") docId: string,
    @Body() dto: UpsertDocumentDto
  ) {
    return this.service.updateDocument(id, docId, dto as never);
  }

  @Delete("directory/:id/documents/:docId")
  @RequirePermissions("directory.manage")
  deleteDoc(@Param("id") id: string, @Param("docId") docId: string) {
    return this.service.deleteDocument(id, docId);
  }

  // ─── Client-side nested licences / insurances / credit applications ─────
  @Post("clients/:clientId/licences")
  @RequirePermissions("directory.manage")
  addClientLicence(@Param("clientId") clientId: string, @Body() dto: UpsertLicenceDto) {
    return this.service.addLicence({ clientId }, dto as never);
  }

  @Patch("clients/:clientId/licences/:licenceId")
  @RequirePermissions("directory.manage")
  patchClientLicence(
    @Param("clientId") clientId: string,
    @Param("licenceId") licenceId: string,
    @Body() dto: UpsertLicenceDto
  ) {
    return this.service.updateLicence({ clientId }, licenceId, dto as never);
  }

  @Delete("clients/:clientId/licences/:licenceId")
  @RequirePermissions("directory.manage")
  deleteClientLicence(
    @Param("clientId") clientId: string,
    @Param("licenceId") licenceId: string
  ) {
    return this.service.deleteLicence({ clientId }, licenceId);
  }

  @Post("clients/:clientId/insurances")
  @RequirePermissions("directory.manage")
  addClientInsurance(@Param("clientId") clientId: string, @Body() dto: UpsertInsuranceDto) {
    return this.service.addInsurance({ clientId }, dto as never);
  }

  @Patch("clients/:clientId/insurances/:insuranceId")
  @RequirePermissions("directory.manage")
  patchClientInsurance(
    @Param("clientId") clientId: string,
    @Param("insuranceId") insuranceId: string,
    @Body() dto: UpsertInsuranceDto
  ) {
    return this.service.updateInsurance({ clientId }, insuranceId, dto as never);
  }

  @Delete("clients/:clientId/insurances/:insuranceId")
  @RequirePermissions("directory.manage")
  deleteClientInsurance(
    @Param("clientId") clientId: string,
    @Param("insuranceId") insuranceId: string
  ) {
    return this.service.deleteInsurance({ clientId }, insuranceId);
  }

  @Post("clients/:clientId/credit-applications")
  @RequirePermissions("directory.manage")
  addClientCreditApp(
    @Param("clientId") clientId: string,
    @Body() dto: UpsertCreditApplicationDto,
    @CurrentUser() actor: { sub: string }
  ) {
    return this.service.addCreditApplication({ clientId }, actor.sub, dto as never);
  }

  @Patch("clients/:clientId/credit-applications/:appId")
  @RequirePermissions("directory.manage")
  patchClientCreditApp(
    @Param("clientId") clientId: string,
    @Param("appId") appId: string,
    @Body() dto: UpsertCreditApplicationDto,
    @CurrentUser() actor: { sub: string },
    @Req() req: AuthedRequest
  ) {
    return this.service.updateCreditApplication(
      { clientId },
      appId,
      actor.sub,
      dto as never,
      hasPermission(req, "directory.admin"),
      hasPermission(req, "finance.manage")
    );
  }
}
