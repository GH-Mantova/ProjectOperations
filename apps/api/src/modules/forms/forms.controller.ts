import { Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { FormsQueryDto, SubmitFormDto, UpsertFormTemplateDto } from "./dto/forms.dto";
import { FormsService } from "./forms.service";

/**
 * REST endpoints for form template authoring and raw submission CRUD.
 *
 * All routes require a JWT plus `forms.view` (reads) or `forms.manage`
 * (writes) permission. Thin pass-through to FormsService — no logic here.
 */
@ApiTags("Forms")
@ApiBearerAuth()
@Controller("forms")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class FormsController {
  constructor(private readonly service: FormsService) {}

  /**
   * List form templates.
   *
   * @param query - optional q/status filters plus page/pageSize
   * @returns paginated `{ items, total, page, pageSize }` of templates with versions
   */
  @Get("templates")
  @RequirePermissions("forms.view")
  @ApiOperation({ summary: "List form templates" })
  @ApiResponse({ status: 200, description: "List form templates." })
  listTemplates(@Query() query: FormsQueryDto) {
    return this.service.listTemplates(query);
  }

  /**
   * Get form template with versions.
   *
   * @param id - form template id
   * @returns the template with all versions, sections, fields and rules
   * @throws NotFoundException when the template does not exist
   */
  @Get("templates/:id")
  @RequirePermissions("forms.view")
  @ApiOperation({ summary: "Get form template with versions" })
  @ApiResponse({ status: 200, description: "Get form template with versions." })
  getTemplate(@Param("id") id: string) {
    return this.service.getTemplate(id);
  }

  /**
   * Create form template and version 1.
   *
   * @param dto - template metadata plus sections/fields/rules for version 1
   * @returns the created template with its versions
   * @throws ConflictException when the template name or code already exists
   */
  @Post("templates")
  @RequirePermissions("forms.manage")
  @ApiOperation({ summary: "Create form template and version 1" })
  @ApiResponse({ status: 201, description: "Create form template and version 1." })
  createTemplate(@Body() dto: UpsertFormTemplateDto, @CurrentUser() actor: { sub: string }) {
    return this.service.createTemplate(dto, actor.sub);
  }

  /**
   * Create next version for existing form template.
   *
   * @param id - existing template id
   * @param dto - full template payload; metadata is updated and a new version is appended
   * @returns the template with its versions, newest first
   * @throws NotFoundException when the template does not exist
   */
  @Post("templates/:id/versions")
  @RequirePermissions("forms.manage")
  @ApiOperation({ summary: "Create next version for existing form template" })
  @ApiResponse({ status: 201, description: "Create next version for existing form template." })
  createVersion(@Param("id") id: string, @Body() dto: UpsertFormTemplateDto, @CurrentUser() actor: { sub: string }) {
    return this.service.createNextVersion(id, dto, actor.sub);
  }

  /**
   * List form submissions.
   *
   * @param query - optional q/status filters plus page/pageSize
   * @returns paginated `{ items, total, page, pageSize }` of submissions
   */
  @Get("submissions")
  @RequirePermissions("forms.view")
  @ApiOperation({ summary: "List form submissions" })
  @ApiResponse({ status: 200, description: "List form submissions." })
  listSubmissions(@Query() query: FormsQueryDto) {
    return this.service.listSubmissions(query);
  }

  /**
   * Get form submission.
   *
   * @param id - submission id
   * @returns the submission with values, attachments, signatures and linked documents
   * @throws NotFoundException when the submission does not exist
   */
  @Get("submissions/:id")
  @RequirePermissions("forms.view")
  @ApiOperation({ summary: "Get form submission" })
  @ApiResponse({ status: 200, description: "Get form submission." })
  getSubmission(@Param("id") id: string) {
    return this.service.getSubmission(id);
  }

  /**
   * Submit a form against a specific template version.
   *
   * @param versionId - template version to submit against
   * @param dto - field values, attachments, signatures and optional entity links
   * @returns the created submission with full detail includes
   * @throws NotFoundException when the template version does not exist
   * @throws ConflictException when a required field is missing from the payload
   */
  @Post("versions/:versionId/submissions")
  @RequirePermissions("forms.manage")
  @ApiOperation({ summary: "Submit a form against a specific template version" })
  @ApiResponse({ status: 201, description: "Submit a form against a specific template version." })
  submit(@Param("versionId") versionId: string, @Body() dto: SubmitFormDto, @CurrentUser() actor: { sub: string }) {
    return this.service.submit(versionId, dto, actor.sub);
  }
}
