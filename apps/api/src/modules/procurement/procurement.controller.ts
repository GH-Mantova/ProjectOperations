import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { ProcurementService } from "./procurement.service";
import {
  CreateProcurementRequestDto,
  IssuePurchaseOrderDto,
  ListProcurementRequestsQueryDto,
  ProcurementRequestStatusDto,
  SubmitProcurementRequestDto,
  UpdateProcurementRequestDto
} from "./dto/procurement.dto";

/**
 * REST endpoints for the procurement request → approval → PO / receipt
 * spine (PR-488 slice 1). Read paths require `procurement.view`; draft and
 * submit paths require `procurement.manage`; approve / issue paths require
 * `procurement.approve`; receipt requires `procurement.receive`.
 */
@ApiTags("Procurement")
@ApiBearerAuth()
@Controller("procurement")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ProcurementController {
  constructor(private readonly service: ProcurementService) {}

  @Get("requests")
  @RequirePermissions("procurement.view")
  @ApiOperation({ summary: "List procurement requests" })
  @ApiQuery({ name: "status", required: false, enum: ProcurementRequestStatusDto })
  @ApiResponse({ status: 200, description: "List procurement requests." })
  listRequests(@Query() query: ListProcurementRequestsQueryDto) {
    return this.service.listRequests(query);
  }

  @Get("requests/:id")
  @RequirePermissions("procurement.view")
  @ApiOperation({ summary: "Get a procurement request with lines and purchase orders" })
  @ApiResponse({ status: 200, description: "Get a procurement request." })
  getRequest(@Param("id") id: string) {
    return this.service.getRequest(id);
  }

  @Post("requests")
  @RequirePermissions("procurement.manage")
  @ApiOperation({ summary: "Create a DRAFT procurement request" })
  @ApiResponse({ status: 201, description: "Create a DRAFT procurement request." })
  createRequest(
    @Body() dto: CreateProcurementRequestDto,
    @CurrentUser() actor: { sub: string }
  ) {
    return this.service.createRequest(dto, actor.sub);
  }

  @Patch("requests/:id")
  @RequirePermissions("procurement.manage")
  @ApiOperation({ summary: "Update a DRAFT procurement request" })
  @ApiResponse({ status: 200, description: "Update a DRAFT procurement request." })
  updateRequest(
    @Param("id") id: string,
    @Body() dto: UpdateProcurementRequestDto,
    @CurrentUser() actor: { sub: string }
  ) {
    return this.service.updateRequest(id, dto, actor.sub);
  }

  @Post("requests/:id/submit")
  @RequirePermissions("procurement.manage")
  @ApiOperation({ summary: "Submit a DRAFT for approval routing" })
  @ApiResponse({ status: 200, description: "Submit a DRAFT for approval routing." })
  submitRequest(
    @Param("id") id: string,
    @Body() dto: SubmitProcurementRequestDto,
    @CurrentUser() actor: { sub: string }
  ) {
    return this.service.submitRequest(id, dto, actor.sub);
  }

  @Post("requests/:id/approve")
  @RequirePermissions("procurement.approve")
  @ApiOperation({ summary: "Approve a SUBMITTED procurement request" })
  @ApiResponse({ status: 200, description: "Approve a SUBMITTED procurement request." })
  approveRequest(@Param("id") id: string, @CurrentUser() actor: { sub: string }) {
    return this.service.approveRequest(id, actor.sub);
  }

  @Post("requests/:id/cancel")
  @RequirePermissions("procurement.manage")
  @ApiOperation({ summary: "Cancel a procurement request" })
  @ApiResponse({ status: 200, description: "Cancel a procurement request." })
  cancelRequest(@Param("id") id: string, @CurrentUser() actor: { sub: string }) {
    return this.service.cancelRequest(id, actor.sub);
  }

  @Post("requests/:id/issue")
  @RequirePermissions("procurement.approve")
  @ApiOperation({ summary: "Issue a purchase order for an APPROVED request" })
  @ApiResponse({ status: 200, description: "Issue a purchase order for an APPROVED request." })
  issueRequest(
    @Param("id") id: string,
    @Body() dto: IssuePurchaseOrderDto,
    @CurrentUser() actor: { sub: string }
  ) {
    return this.service.issuePurchaseOrder(id, dto, actor.sub);
  }

  @Post("requests/:id/receive")
  @RequirePermissions("procurement.receive")
  @ApiOperation({ summary: "Record receipt of an ISSUED request — posts RECEIVE movements" })
  @ApiResponse({ status: 200, description: "Record receipt of an ISSUED request." })
  receiveRequest(@Param("id") id: string, @CurrentUser() actor: { sub: string }) {
    return this.service.receiveRequest(id, actor.sub);
  }
}
