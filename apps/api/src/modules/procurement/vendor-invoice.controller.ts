import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags
} from "@nestjs/swagger";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { VendorInvoiceService } from "./vendor-invoice.service";
import {
  ApproveInvoiceVarianceDto,
  CreateVendorInvoiceDto,
  InvoiceMatchStatusDto,
  ListVendorInvoicesQueryDto,
  ReconcilePoDto
} from "./dto/vendor-invoice.dto";

/**
 * REST endpoints for the three-way match (PO vs receipt vs vendor invoice).
 *
 * Scoping:
 *   READ  — procurement.view
 *   WRITE — procurement.manage   (post invoice)
 *   APPROVE variance / reconcile — procurement.approve
 *
 * All invoice endpoints are nested under /procurement/purchase-orders/:poId
 * so the PO is always the primary resource and every invoice is
 * unambiguously scoped to its PO.
 */
@ApiTags("Procurement")
@ApiBearerAuth()
@Controller("procurement/purchase-orders/:poId")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class VendorInvoiceController {
  constructor(private readonly service: VendorInvoiceService) {}

  // ── Invoice list / detail ──────────────────────────────────────────────

  @Get("invoices")
  @RequirePermissions("procurement.view")
  @ApiOperation({ summary: "List vendor invoices posted against a PurchaseOrder" })
  @ApiQuery({ name: "status", required: false, enum: InvoiceMatchStatusDto })
  @ApiResponse({ status: 200, description: "Paginated list of vendor invoices." })
  listInvoices(
    @Param("poId") poId: string,
    @Query() query: ListVendorInvoicesQueryDto
  ) {
    return this.service.listInvoices(poId, query);
  }

  @Get("invoices/:id")
  @RequirePermissions("procurement.view")
  @ApiOperation({ summary: "Get a vendor invoice with its three-way match lines" })
  @ApiResponse({ status: 200, description: "Vendor invoice with match lines." })
  getInvoice(@Param("id") id: string) {
    return this.service.getInvoice(id);
  }

  // ── Post + match ───────────────────────────────────────────────────────

  @Post("invoices")
  @RequirePermissions("procurement.manage")
  @ApiOperation({
    summary:
      "Post a vendor invoice against a PO and run the three-way match (PO vs receipt vs billed)"
  })
  @ApiResponse({
    status: 201,
    description:
      "Invoice created. matchStatus is MATCHED (all lines within tolerance) or " +
      "HELD (variance above tolerance — needs procurement.approve to clear)."
  })
  createInvoice(
    @Param("poId") poId: string,
    @Body() dto: CreateVendorInvoiceDto,
    @CurrentUser() actor: { sub: string }
  ) {
    return this.service.createInvoice(poId, dto, actor.sub);
  }

  // ── Variance approval ──────────────────────────────────────────────────

  @Post("invoices/:id/approve-variance")
  @RequirePermissions("procurement.approve")
  @ApiOperation({
    summary: "Approve the variance on a HELD vendor invoice via the authority seam"
  })
  @ApiResponse({
    status: 200,
    description: "Invoice moves from HELD to APPROVED (ready-to-pay)."
  })
  approveVariance(
    @Param("id") id: string,
    @Body() dto: ApproveInvoiceVarianceDto,
    @CurrentUser() actor: { sub: string }
  ) {
    return this.service.approveVariance(id, dto, actor.sub);
  }

  // ── Reconcile / close ──────────────────────────────────────────────────

  @Post("reconcile")
  @RequirePermissions("procurement.approve")
  @ApiOperation({
    summary:
      "Close-reconcile a PurchaseOrder — writes a PoReconcileAudit for the project-close audit. " +
      "All invoices must be MATCHED or APPROVED first."
  })
  @ApiResponse({
    status: 201,
    description: "PoReconcileAudit record (one per PO, idempotent guard)."
  })
  reconcilePo(
    @Param("poId") poId: string,
    @Body() dto: ReconcilePoDto,
    @CurrentUser() actor: { sub: string }
  ) {
    return this.service.reconcilePo(poId, dto, actor.sub);
  }

  @Get("reconcile")
  @RequirePermissions("procurement.view")
  @ApiOperation({ summary: "Get the reconcile audit record for a PurchaseOrder" })
  @ApiResponse({ status: 200, description: "PoReconcileAudit record." })
  getReconcileAudit(@Param("poId") poId: string) {
    return this.service.getPoReconcileAudit(poId);
  }
}
