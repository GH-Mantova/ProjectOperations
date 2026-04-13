import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { PaginationQueryDto } from "../../common/dto/pagination-query.dto";
import { CreateRoleDto } from "./dto/create-role.dto";
import { RolesService } from "./roles.service";
import { UpdateRoleDto } from "./dto/update-role.dto";

@ApiTags("Roles")
@ApiBearerAuth()
@Controller("roles")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  @RequirePermissions("roles.view")
  @ApiOperation({ summary: "List roles" })
  list(@Query() query: PaginationQueryDto) {
    return this.rolesService.list(query);
  }

  @Post()
  @RequirePermissions("roles.create")
  @ApiOperation({ summary: "Create a role" })
  create(@Body() dto: CreateRoleDto, @CurrentUser() actor: { sub: string }) {
    return this.rolesService.create(dto, actor.sub);
  }

  @Patch(":id")
  @RequirePermissions("roles.update")
  @ApiOperation({ summary: "Update a role" })
  update(
    @Param("id") roleId: string,
    @Body() dto: UpdateRoleDto,
    @CurrentUser() actor: { sub: string }
  ) {
    return this.rolesService.update(roleId, dto, actor.sub);
  }
}
