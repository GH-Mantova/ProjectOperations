import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { PaginationQueryDto } from "../../common/dto/pagination-query.dto";
import { AuditService } from "./audit.service";

@ApiTags("Audit")
@ApiBearerAuth()
@Controller("audit-logs")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @RequirePermissions("audit.view")
  @ApiOperation({ summary: "List audit logs" })
  list(@Query() query: PaginationQueryDto) {
    return this.auditService.list(query);
  }
}
