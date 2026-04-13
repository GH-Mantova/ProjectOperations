import { Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { FormsQueryDto, SubmitFormDto, UpsertFormTemplateDto } from "./dto/forms.dto";
import { FormsService } from "./forms.service";

@ApiTags("Forms")
@ApiBearerAuth()
@Controller("forms")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class FormsController {
  constructor(private readonly service: FormsService) {}

  @Get("templates")
  @RequirePermissions("forms.view")
  @ApiOperation({ summary: "List form templates" })
  listTemplates(@Query() query: FormsQueryDto) {
    return this.service.listTemplates(query);
  }

  @Get("templates/:id")
  @RequirePermissions("forms.view")
  @ApiOperation({ summary: "Get form template with versions" })
  getTemplate(@Param("id") id: string) {
    return this.service.getTemplate(id);
  }

  @Post("templates")
  @RequirePermissions("forms.manage")
  @ApiOperation({ summary: "Create form template and version 1" })
  createTemplate(@Body() dto: UpsertFormTemplateDto, @CurrentUser() actor: { sub: string }) {
    return this.service.createTemplate(dto, actor.sub);
  }

  @Post("templates/:id/versions")
  @RequirePermissions("forms.manage")
  @ApiOperation({ summary: "Create next version for existing form template" })
  createVersion(@Param("id") id: string, @Body() dto: UpsertFormTemplateDto, @CurrentUser() actor: { sub: string }) {
    return this.service.createNextVersion(id, dto, actor.sub);
  }

  @Get("submissions")
  @RequirePermissions("forms.view")
  @ApiOperation({ summary: "List form submissions" })
  listSubmissions(@Query() query: FormsQueryDto) {
    return this.service.listSubmissions(query);
  }

  @Get("submissions/:id")
  @RequirePermissions("forms.view")
  @ApiOperation({ summary: "Get form submission" })
  getSubmission(@Param("id") id: string) {
    return this.service.getSubmission(id);
  }

  @Post("versions/:versionId/submissions")
  @RequirePermissions("forms.manage")
  @ApiOperation({ summary: "Submit a form against a specific template version" })
  submit(@Param("versionId") versionId: string, @Body() dto: SubmitFormDto, @CurrentUser() actor: { sub: string }) {
    return this.service.submit(versionId, dto, actor.sub);
  }
}
