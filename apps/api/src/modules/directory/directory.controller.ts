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
import { ApiBearerAuth, ApiOperation, ApiPropertyOptional, ApiQuery, ApiResponse, ApiTags } from "@nestjs/swagger";
import { IsArray, IsBoolean, IsIn, IsInt, IsNumber, IsOptional, IsString, Max, Min } from "class-validator";
import { Type } from "class-transformer";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { PAYMENT_TERMS_TYPES, PaymentTermsType } from "../master-data/payment-terms.const";
import { DirectoryService } from "./directory.service";

type AuthedRequest = { user?: { permissionCodes?: string[] } };

function hasPermission(req: AuthedRequest, code: string): boolean {
  return Array.isArray(req.user?.permissionCodes) && (req.user?.permissionCodes ?? []).includes(code);
}

/**
 * Payload for creating or updating a subcontractor/supplier entry. Used by
 * both `POST /directory` (create — `name` required) and `PATCH /directory/:id`
 * (update — all fields optional). Includes business directory fields, prequal
 * state, bank details (gated by `directory.finance`), and the Xero alignment
 * fields whose `paymentTermsDay` / `paymentTermsType` pair the service layer
 * enforces must be set together.
 */
class UpsertSubcontractorDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() tradingName?: string | null;
  @IsOptional() @IsString() businessType?: string;
  @IsOptional() @IsString() abn?: string | null;
  @IsOptional() @IsString() acn?: string | null;
  @IsOptional() @IsBoolean() gstRegistered?: boolean;
  @IsOptional() @IsString() website?: string | null;
  @IsOptional() @IsString() entityType?: string;
  @ApiPropertyOptional({ type: [String], description: "Work categories. Optional — defaults to [] on create." })
  @IsOptional() @IsArray() @IsString({ each: true }) categories?: string[];

  @ApiPropertyOptional({ description: "Prequalification status. Optional — new entries default to 'pending' (prequal workflow entry state)." })
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

  // Xero alignment (PR-40)
  @ApiPropertyOptional({ description: "Legal entity name as it appears on contracts/invoices (distinct from display `name` and `tradingName`)." })
  @IsOptional() @IsString() legalName?: string | null;

  @ApiPropertyOptional({ description: "Country of the organisation. Defaults to 'Australia'." })
  @IsOptional() @IsString() country?: string;

  @ApiPropertyOptional({ description: "Day-of-month component of the Xero payment-terms pair (1–31). Must be supplied with `paymentTermsType`." })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(31) paymentTermsDay?: number | null;

  @ApiPropertyOptional({ enum: PAYMENT_TERMS_TYPES, description: "Vocabulary that mirrors Xero's contact payment-terms. Must be supplied with `paymentTermsDay`." })
  @IsOptional() @IsIn(PAYMENT_TERMS_TYPES as unknown as string[]) paymentTermsType?: PaymentTermsType | null;
}

/**
 * Payload for adding or patching a contact nested under a subcontractor
 * (`/directory/:id/contacts`). Maps onto the polymorphic Contact model with
 * `organisationType = "SUBCONTRACTOR"` set server-side. `firstName` /
 * `lastName` are required on create and enforced at the service layer.
 */
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

  @ApiPropertyOptional({ description: "CC this contact on invoice/quote emails sent to their organisation." })
  @IsOptional() @IsBoolean() includeInInvoiceEmails?: boolean;
}

/**
 * Payload for adding or patching a polymorphic EntityLicence on either a
 * client or a subcontractor. The owning entity is taken from the route, not
 * the body. `licenceType` is required on create. Date fields accept ISO
 * strings and are parsed server-side.
 */
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

/**
 * Payload for adding or patching a polymorphic EntityInsurance on either a
 * client or a subcontractor. The owning entity is taken from the route.
 * `insuranceType` is required on create. `expiryDate` accepts ISO strings
 * and is parsed server-side.
 */
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

/**
 * Payload for adding or patching a polymorphic CreditApplication on either
 * a client or a subcontractor. `direction` is required on create
 * (`outgoing` = we extend credit to a customer, `incoming` = we receive
 * credit from a supplier). Status transitions are enforced server-side
 * against the caller's `directory.admin` / `finance.manage` permissions.
 */
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

/**
 * Payload for adding or patching a SubcontractorDocument metadata row.
 * `documentType` and `name` are required on create. The actual file lives
 * wherever `filePath` points (SharePoint adapter).
 */
class UpsertDocumentDto {
  @IsOptional() @IsString() documentType?: string;
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() filePath?: string | null;
  @IsOptional() @IsString() notes?: string | null;
}

/**
 * Payload for `PATCH /directory/:id/prequal`. Updates the prequalification
 * status (required, must be in the fixed vocabulary) plus optional notes;
 * the service layer stamps reviewer + timestamp.
 */
class UpdatePrequalDto {
  @IsString() prequalStatus!: string;
  @IsOptional() @IsString() prequalNotes?: string | null;
}

/**
 * HTTP surface for the directory module — subcontractors / suppliers and the
 * licences, insurances, credit applications, documents, and contacts that
 * hang off them. Also exposes nested licence / insurance / credit-application
 * routes on the client side so the same record types can live on either
 * polymorphic owner.
 *
 * All routes are protected by JWT + the `PermissionsGuard`. Read routes
 * require `directory.view`; mutating routes require `directory.manage`;
 * destructive and prequal changes require `directory.admin`. Bank fields
 * additionally require `directory.finance` for both visibility and write —
 * enforced at the field level rather than the route level (see
 * `stripBankFromInput` and `maskBank` in {@link DirectoryService}).
 */
@ApiTags("Directory")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller()
export class DirectoryController {
  constructor(private readonly service: DirectoryService) {}

  // ─── Subcontractor list / get / CRUD ────────────────────────────────────
  /** Paginated-by-name list of subcontractors/suppliers with a precomputed `expiryAlerts` count. */
  @Get("directory")
  @RequirePermissions("directory.view")
  @ApiOperation({ summary: "List subcontractors/suppliers with filters + expiry alerts count." })
  @ApiResponse({ status: 200, description: "List subcontractors/suppliers with filters + expiry alerts count." })
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

  /** Flat list of licences + insurances expired or expiring within 30 days, sorted by urgency. */
  @Get("directory/expiry-alerts")
  @RequirePermissions("directory.view")
  @ApiOperation({ summary: "Licences + insurances expiring within 30 days or already expired." })
  @ApiResponse({ status: 200, description: "Alerts sorted by expiry (most urgent first)." })
  expiryAlerts() {
    return this.service.expiryAlerts();
  }

  /** Full subcontractor record (contacts, licences, insurances, docs, credit apps); bank fields masked without `directory.finance`. */
  @Get("directory/:id")
  @RequirePermissions("directory.view")
  @ApiOperation({ summary: "Full subcontractor record with contacts, licences, insurances, docs, credit apps." })
  @ApiResponse({ status: 200, description: "Full subcontractor record with contacts, licences, insurances, docs, credit apps." })
  get(@Param("id") id: string, @Req() req: AuthedRequest) {
    return this.service.get(id, hasPermission(req, "directory.finance"));
  }

  /** Create a subcontractor/supplier; auto-creates a primary contact for `private_person`. Bank fields require `directory.finance`. */
  @Post("directory")
  @RequirePermissions("directory.manage")
  @ApiOperation({ summary: "Create a subcontractor/supplier entry. Auto-creates primary contact for private_person." })
  @ApiResponse({ status: 201, description: "Create a subcontractor/supplier entry. Auto-creates primary contact for private_person." })
  create(
    @Body() dto: UpsertSubcontractorDto,
    @CurrentUser() actor: { sub: string },
    @Req() req: AuthedRequest
  ) {
    return this.service.create(dto as never, actor.sub, hasPermission(req, "directory.finance"));
  }

  /** Patch a subcontractor/supplier; bank fields silently stripped if caller lacks `directory.finance`. */
  @Patch("directory/:id")
  @RequirePermissions("directory.manage")
  @ApiOperation({ summary: "Update subcontractor/supplier fields. Bank details require directory.finance." })
  @ApiResponse({ status: 200, description: "Update subcontractor/supplier fields. Bank details require directory.finance." })
  update(@Param("id") id: string, @Body() dto: UpsertSubcontractorDto, @Req() req: AuthedRequest) {
    return this.service.update(id, dto as never, hasPermission(req, "directory.finance"));
  }

  /** Soft-delete (`isActive = false`); the row is preserved so historical references keep resolving. */
  @Delete("directory/:id")
  @RequirePermissions("directory.admin")
  @ApiOperation({ summary: "Soft-delete (set isActive=false)." })
  @ApiResponse({ status: 200, description: "Soft-delete (set isActive=false)." })
  remove(@Param("id") id: string) {
    return this.service.softDelete(id);
  }

  /** Update prequalification status + notes; stamps `prequalReviewedAt` and `prequalReviewedBy`. */
  @Patch("directory/:id/prequal")
  @RequirePermissions("directory.admin")
  @ApiOperation({ summary: "Update prequalification status + notes." })
  @ApiResponse({ status: 200, description: "Update prequalification status + notes." })
  updatePrequal(
    @Param("id") id: string,
    @Body() dto: UpdatePrequalDto,
    @CurrentUser() actor: { sub: string }
  ) {
    return this.service.updatePrequal(id, actor.sub, dto);
  }

  // ─── Subcontractor contacts ─────────────────────────────────────────────
  /** Attach a contact to a subcontractor; demotes any other primary contact on the same parent if `isPrimary` is set. */
  @Post("directory/:id/contacts")
  @RequirePermissions("directory.manage")
  @ApiOperation({ summary: "Add a contact to a subcontractor." })
  @ApiResponse({ status: 201, description: "Contact added." })
  addContact(
    @Param("id") id: string,
    @Body() dto: UpsertContactDto,
    @CurrentUser() actor: { sub: string }
  ) {
    return this.service.addContact(id, dto as never, actor.sub);
  }

  /** Patch a contact, scoped to its subcontractor parent. */
  @Patch("directory/:id/contacts/:contactId")
  @RequirePermissions("directory.manage")
  @ApiOperation({ summary: "Update a subcontractor contact." })
  @ApiResponse({ status: 200, description: "Updated contact." })
  @ApiResponse({ status: 404, description: "Contact not found." })
  patchContact(
    @Param("id") id: string,
    @Param("contactId") contactId: string,
    @Body() dto: UpsertContactDto
  ) {
    return this.service.updateContact(id, contactId, dto as never);
  }

  /** Hard-delete a contact, scoped to its subcontractor parent. */
  @Delete("directory/:id/contacts/:contactId")
  @RequirePermissions("directory.manage")
  @ApiOperation({ summary: "Delete a subcontractor contact." })
  @ApiResponse({ status: 200, description: "Contact deleted." })
  @ApiResponse({ status: 404, description: "Contact not found." })
  deleteContact(@Param("id") id: string, @Param("contactId") contactId: string) {
    return this.service.deleteContact(id, contactId);
  }

  // ─── Subcontractor licences ─────────────────────────────────────────────
  /** Attach a licence to a subcontractor; date strings are parsed server-side. */
  @Post("directory/:id/licences")
  @RequirePermissions("directory.manage")
  @ApiOperation({ summary: "Add a licence to a subcontractor." })
  @ApiResponse({ status: 201, description: "Licence added." })
  addSubLicence(@Param("id") id: string, @Body() dto: UpsertLicenceDto) {
    return this.service.addLicence({ subcontractorId: id }, dto as never);
  }

  /** Patch a licence, scoped to its subcontractor parent; returns the row with refreshed `status`. */
  @Patch("directory/:id/licences/:licenceId")
  @RequirePermissions("directory.manage")
  @ApiOperation({ summary: "Update a subcontractor licence." })
  @ApiResponse({ status: 200, description: "Updated licence." })
  @ApiResponse({ status: 404, description: "Licence not found." })
  patchSubLicence(
    @Param("id") id: string,
    @Param("licenceId") licenceId: string,
    @Body() dto: UpsertLicenceDto
  ) {
    return this.service.updateLicence({ subcontractorId: id }, licenceId, dto as never);
  }

  /** Hard-delete a licence, scoped to its subcontractor parent. */
  @Delete("directory/:id/licences/:licenceId")
  @RequirePermissions("directory.manage")
  @ApiOperation({ summary: "Delete a subcontractor licence." })
  @ApiResponse({ status: 200, description: "Licence deleted." })
  @ApiResponse({ status: 404, description: "Licence not found." })
  deleteSubLicence(@Param("id") id: string, @Param("licenceId") licenceId: string) {
    return this.service.deleteLicence({ subcontractorId: id }, licenceId);
  }

  // ─── Subcontractor insurances ───────────────────────────────────────────
  /** Attach an insurance row to a subcontractor; `expiryDate` parsed server-side. */
  @Post("directory/:id/insurances")
  @RequirePermissions("directory.manage")
  @ApiOperation({ summary: "Add an insurance row to a subcontractor." })
  @ApiResponse({ status: 201, description: "Insurance added." })
  addSubInsurance(@Param("id") id: string, @Body() dto: UpsertInsuranceDto) {
    return this.service.addInsurance({ subcontractorId: id }, dto as never);
  }

  /** Patch an insurance row, scoped to its subcontractor parent; returns the row with refreshed `status`. */
  @Patch("directory/:id/insurances/:insuranceId")
  @RequirePermissions("directory.manage")
  @ApiOperation({ summary: "Update a subcontractor insurance row." })
  @ApiResponse({ status: 200, description: "Updated insurance." })
  @ApiResponse({ status: 404, description: "Insurance not found." })
  patchSubInsurance(
    @Param("id") id: string,
    @Param("insuranceId") insuranceId: string,
    @Body() dto: UpsertInsuranceDto
  ) {
    return this.service.updateInsurance({ subcontractorId: id }, insuranceId, dto as never);
  }

  /** Hard-delete an insurance row, scoped to its subcontractor parent. */
  @Delete("directory/:id/insurances/:insuranceId")
  @RequirePermissions("directory.manage")
  @ApiOperation({ summary: "Delete a subcontractor insurance row." })
  @ApiResponse({ status: 200, description: "Insurance deleted." })
  @ApiResponse({ status: 404, description: "Insurance not found." })
  deleteSubInsurance(@Param("id") id: string, @Param("insuranceId") insuranceId: string) {
    return this.service.deleteInsurance({ subcontractorId: id }, insuranceId);
  }

  // ─── Subcontractor credit applications ──────────────────────────────────
  /** Create a credit application on a subcontractor; `direction` is required. */
  @Post("directory/:id/credit-applications")
  @RequirePermissions("directory.manage")
  @ApiOperation({ summary: "Create a credit application on a subcontractor." })
  @ApiResponse({ status: 201, description: "Credit application created." })
  addSubCreditApp(
    @Param("id") id: string,
    @Body() dto: UpsertCreditApplicationDto,
    @CurrentUser() actor: { sub: string }
  ) {
    return this.service.addCreditApplication({ subcontractorId: id }, actor.sub, dto as never);
  }

  /** Patch a credit application on a subcontractor; status transitions enforced against `directory.admin` and `finance.manage`. */
  @Patch("directory/:id/credit-applications/:appId")
  @RequirePermissions("directory.manage")
  @ApiOperation({ summary: "Update a subcontractor credit application." })
  @ApiResponse({ status: 200, description: "Updated credit application." })
  @ApiResponse({ status: 404, description: "Credit application not found." })
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
  /** Attach a document metadata row to a subcontractor; `uploadedById` is taken from the caller. */
  @Post("directory/:id/documents")
  @RequirePermissions("directory.manage")
  @ApiOperation({ summary: "Add a document metadata row to a subcontractor." })
  @ApiResponse({ status: 201, description: "Document added." })
  addDoc(
    @Param("id") id: string,
    @Body() dto: UpsertDocumentDto,
    @CurrentUser() actor: { sub: string }
  ) {
    return this.service.addDocument(id, actor.sub, dto as never);
  }

  /** Patch a document metadata row, scoped to its subcontractor parent. */
  @Patch("directory/:id/documents/:docId")
  @RequirePermissions("directory.manage")
  @ApiOperation({ summary: "Update a subcontractor document metadata row." })
  @ApiResponse({ status: 200, description: "Updated document." })
  @ApiResponse({ status: 404, description: "Document not found." })
  patchDoc(
    @Param("id") id: string,
    @Param("docId") docId: string,
    @Body() dto: UpsertDocumentDto
  ) {
    return this.service.updateDocument(id, docId, dto as never);
  }

  /** Hard-delete a document metadata row; the underlying file in storage is not touched. */
  @Delete("directory/:id/documents/:docId")
  @RequirePermissions("directory.manage")
  @ApiOperation({ summary: "Delete a subcontractor document metadata row." })
  @ApiResponse({ status: 200, description: "Document deleted." })
  @ApiResponse({ status: 404, description: "Document not found." })
  deleteDoc(@Param("id") id: string, @Param("docId") docId: string) {
    return this.service.deleteDocument(id, docId);
  }

  // ─── Client-side nested licences / insurances / credit applications ─────
  /** Attach a licence to a client (polymorphic owner = `clientId`). */
  @Post("clients/:clientId/licences")
  @RequirePermissions("directory.manage")
  @ApiOperation({ summary: "Add a licence to a client." })
  @ApiResponse({ status: 201, description: "Licence added." })
  addClientLicence(@Param("clientId") clientId: string, @Body() dto: UpsertLicenceDto) {
    return this.service.addLicence({ clientId }, dto as never);
  }

  /** Patch a licence, scoped to its client parent. */
  @Patch("clients/:clientId/licences/:licenceId")
  @RequirePermissions("directory.manage")
  @ApiOperation({ summary: "Update a client licence." })
  @ApiResponse({ status: 200, description: "Updated licence." })
  @ApiResponse({ status: 404, description: "Licence not found." })
  patchClientLicence(
    @Param("clientId") clientId: string,
    @Param("licenceId") licenceId: string,
    @Body() dto: UpsertLicenceDto
  ) {
    return this.service.updateLicence({ clientId }, licenceId, dto as never);
  }

  /** Hard-delete a licence, scoped to its client parent. */
  @Delete("clients/:clientId/licences/:licenceId")
  @RequirePermissions("directory.manage")
  @ApiOperation({ summary: "Delete a client licence." })
  @ApiResponse({ status: 200, description: "Licence deleted." })
  @ApiResponse({ status: 404, description: "Licence not found." })
  deleteClientLicence(
    @Param("clientId") clientId: string,
    @Param("licenceId") licenceId: string
  ) {
    return this.service.deleteLicence({ clientId }, licenceId);
  }

  /** Attach an insurance row to a client. */
  @Post("clients/:clientId/insurances")
  @RequirePermissions("directory.manage")
  @ApiOperation({ summary: "Add an insurance row to a client." })
  @ApiResponse({ status: 201, description: "Insurance added." })
  addClientInsurance(@Param("clientId") clientId: string, @Body() dto: UpsertInsuranceDto) {
    return this.service.addInsurance({ clientId }, dto as never);
  }

  /** Patch an insurance row, scoped to its client parent. */
  @Patch("clients/:clientId/insurances/:insuranceId")
  @RequirePermissions("directory.manage")
  @ApiOperation({ summary: "Update a client insurance row." })
  @ApiResponse({ status: 200, description: "Updated insurance." })
  @ApiResponse({ status: 404, description: "Insurance not found." })
  patchClientInsurance(
    @Param("clientId") clientId: string,
    @Param("insuranceId") insuranceId: string,
    @Body() dto: UpsertInsuranceDto
  ) {
    return this.service.updateInsurance({ clientId }, insuranceId, dto as never);
  }

  /** Hard-delete an insurance row, scoped to its client parent. */
  @Delete("clients/:clientId/insurances/:insuranceId")
  @RequirePermissions("directory.manage")
  @ApiOperation({ summary: "Delete a client insurance row." })
  @ApiResponse({ status: 200, description: "Insurance deleted." })
  @ApiResponse({ status: 404, description: "Insurance not found." })
  deleteClientInsurance(
    @Param("clientId") clientId: string,
    @Param("insuranceId") insuranceId: string
  ) {
    return this.service.deleteInsurance({ clientId }, insuranceId);
  }

  /** Create a credit application on a client; `direction` is required. */
  @Post("clients/:clientId/credit-applications")
  @RequirePermissions("directory.manage")
  @ApiOperation({ summary: "Create a credit application on a client." })
  @ApiResponse({ status: 201, description: "Credit application created." })
  addClientCreditApp(
    @Param("clientId") clientId: string,
    @Body() dto: UpsertCreditApplicationDto,
    @CurrentUser() actor: { sub: string }
  ) {
    return this.service.addCreditApplication({ clientId }, actor.sub, dto as never);
  }

  /** Patch a credit application on a client; status transitions enforced against `directory.admin` and `finance.manage`. */
  @Patch("clients/:clientId/credit-applications/:appId")
  @RequirePermissions("directory.manage")
  @ApiOperation({ summary: "Update a client credit application." })
  @ApiResponse({ status: 200, description: "Updated credit application." })
  @ApiResponse({ status: 404, description: "Credit application not found." })
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
