import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { IsString } from "class-validator";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { TenderClientsService } from "./tender-clients.service";

class AddClientDto {
  @IsString() clientId!: string;
}

@ApiTags("Tender Clients")
@ApiBearerAuth()
@Controller("tenders/:tenderId/clients")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class TenderClientsController {
  constructor(private readonly service: TenderClientsService) {}

  @Get()
  @RequirePermissions("tenders.view")
  @ApiOperation({ summary: "List clients linked to a tender with basic contact info." })
  list(@Param("tenderId") tenderId: string) {
    return this.service.listClients(tenderId);
  }

  @Post()
  @RequirePermissions("tenders.manage")
  @ApiOperation({ summary: "Link an additional client to the tender." })
  @ApiResponse({ status: 404, description: "Client not found." })
  @ApiResponse({ status: 409, description: "Client is already linked." })
  add(@Param("tenderId") tenderId: string, @Body() dto: AddClientDto) {
    return this.service.addClient(tenderId, dto.clientId);
  }

  @Delete(":clientId")
  @RequirePermissions("tenders.manage")
  @ApiOperation({ summary: "Unlink a client from the tender. Refuses if this is the last client." })
  @ApiResponse({ status: 400, description: "Cannot remove the last client from a tender." })
  @ApiResponse({ status: 404, description: "Client not linked to this tender." })
  remove(@Param("tenderId") tenderId: string, @Param("clientId") clientId: string) {
    return this.service.removeClient(tenderId, clientId);
  }
}

@ApiTags("Tender Clients")
@ApiBearerAuth()
@Controller("tendering/clients")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class TenderClientSearchController {
  constructor(private readonly service: TenderClientsService) {}

  @Get("search")
  @RequirePermissions("tenders.view")
  @ApiOperation({
    summary:
      "Search active clients by name (case-insensitive contains match). Returns up to 10. Used by the Overview Add-client modal."
  })
  search(@Query("q") q?: string) {
    return this.service.searchClients(q ?? "");
  }
}
