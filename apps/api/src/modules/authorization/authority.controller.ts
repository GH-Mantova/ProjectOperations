import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  UseGuards
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { AuthorityService } from "./authority.service";
import { CreateAuthorityRuleDto } from "./dto/create-authority-rule.dto";
import { UpdateAuthorityRuleDto } from "./dto/update-authority-rule.dto";

/**
 * HTTP surface for the configurable authority rule store. All routes
 * require `authority.manage`. Read routes list the current ruleset;
 * write routes CRUD it. Rule evaluation itself lives in AuthorityService
 * and is not exposed here — consumers call it in-process.
 */
@ApiTags("Authority")
@ApiBearerAuth()
@Controller("authority/rules")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AuthorityController {
  constructor(private readonly authorityService: AuthorityService) {}

  @Get()
  @RequirePermissions("authority.manage")
  @ApiOperation({ summary: "List authority rules" })
  @ApiResponse({ status: 200, description: "List authority rules." })
  list() {
    return this.authorityService.list();
  }

  @Post()
  @RequirePermissions("authority.manage")
  @ApiOperation({ summary: "Create an authority rule" })
  @ApiResponse({ status: 201, description: "Create an authority rule." })
  create(@Body() dto: CreateAuthorityRuleDto, @CurrentUser() actor: { sub: string }) {
    return this.authorityService.create(dto, actor.sub);
  }

  @Patch(":id")
  @RequirePermissions("authority.manage")
  @ApiOperation({ summary: "Update an authority rule" })
  @ApiResponse({ status: 200, description: "Update an authority rule." })
  update(
    @Param("id") id: string,
    @Body() dto: UpdateAuthorityRuleDto,
    @CurrentUser() actor: { sub: string }
  ) {
    return this.authorityService.update(id, dto, actor.sub);
  }

  @Delete(":id")
  @HttpCode(200)
  @RequirePermissions("authority.manage")
  @ApiOperation({ summary: "Delete an authority rule" })
  @ApiResponse({ status: 200, description: "Delete an authority rule." })
  @ApiResponse({ status: 409, description: "Rule is enabled; disable it first." })
  remove(@Param("id") id: string, @CurrentUser() actor: { sub: string }) {
    return this.authorityService.remove(id, actor.sub);
  }
}
