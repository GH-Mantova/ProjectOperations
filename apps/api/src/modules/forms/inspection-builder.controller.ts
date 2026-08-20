import {
  BadRequestException,
  Body,
  Controller,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags
} from "@nestjs/swagger";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import type { AuthenticatedUser } from "../../common/auth/authenticated-request.interface";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import {
  BuildFormFromDescriptionDto,
  BuildFormFromDescriptionResponseDto,
  BuildFormFromPdfResponseDto,
  DraftRuleDto
} from "./dto/inspection-builder.dto";
import { InspectionBuilderService } from "./inspection-builder.service";
import { AiFormDescribeService } from "./ai-form-describe.service";
import { AiRuleDraftService } from "./ai-rule-draft.service";
import type { FieldRule } from "@project-ops/config/forms-rule-definition";

// 10 MB -- comfortably fits a multi-page A4 checklist scanned as PDF, and
// well under the 25 MB cap Anthropic imposes on document uploads. Rejects
// oversized files at the multer layer so we never buffer a 500 MB blob
// just to fail parse.
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

/**
 * `InspectionBuilderController` -- AI-assisted form template authoring endpoints.
 *
 * `POST /forms/templates/build-from-pdf` -- accepts a multipart PDF upload
 * and returns the id of a freshly-created DRAFT template.
 *
 * `POST /forms/templates/build-from-description` -- accepts a plain-language
 * description and returns the id of a freshly-created DRAFT template.
 *
 * `POST /forms/templates/draft-rule` -- accepts a plain-language rule
 * description plus the form's field list and returns a drafted FieldRule
 * condition/action tree for review in the rules builder. Never persists the
 * returned draft -- the human must click "Save rules" in the builder.
 *
 * All three endpoints require `forms.manage`. Provider resolution uses the
 * caller's BYOK / company-key path (same key store as the assist panel).
 */
@ApiTags("Forms")
@ApiBearerAuth()
@Controller("forms")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class InspectionBuilderController {
  constructor(
    private readonly builder: InspectionBuilderService,
    private readonly describer: AiFormDescribeService,
    private readonly ruleDrafter: AiRuleDraftService
  ) {}

  @Post("templates/build-from-pdf")
  @RequirePermissions("forms.manage")
  @UseInterceptors(
    FileInterceptor("file", {
      limits: { fileSize: MAX_UPLOAD_BYTES }
    })
  )
  @ApiConsumes("multipart/form-data")
  @ApiOperation({
    summary: "Build a DRAFT form template from an uploaded PDF",
    description:
      "Extracts text from the uploaded PDF, calls the caller's configured AI provider (BYOK via AiProvidersService -- same key store as the assist panel) to derive sections + fields, and creates a DRAFT FormTemplate. Never publishes the template -- the user must open it in the designer and press publish. Requires forms.manage."
  })
  @ApiResponse({ status: 201, description: "Draft form template created.", type: BuildFormFromPdfResponseDto })
  @ApiResponse({ status: 400, description: "Missing/invalid PDF, or PDF has no text layer (scanned)." })
  @ApiResponse({ status: 403, description: "Missing forms.manage permission." })
  @ApiResponse({ status: 503, description: "AI provider not configured or upstream error." })
  async buildFromPdf(
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentUser() actor: AuthenticatedUser
  ): Promise<BuildFormFromPdfResponseDto> {
    if (!file) {
      throw new BadRequestException("Upload a PDF file in the `file` multipart field.");
    }
    return this.builder.buildFromPdf(file, actor.sub);
  }

  @Post("templates/build-from-description")
  @RequirePermissions("forms.manage")
  @ApiOperation({
    summary: "Build a DRAFT form template from a plain-language description",
    description:
      "Accepts a plain-language description (e.g. \"a working-at-heights permit with 2-stage sign-off\") and creates a DRAFT FormTemplate via the caller's configured AI provider. Never publishes the template -- the user must open the designer and press publish. Requires forms.manage."
  })
  @ApiResponse({ status: 201, description: "Draft form template created.", type: BuildFormFromDescriptionResponseDto })
  @ApiResponse({ status: 400, description: "Description is missing or too long." })
  @ApiResponse({ status: 403, description: "Missing forms.manage permission." })
  @ApiResponse({ status: 503, description: "AI provider not configured or upstream error." })
  async buildFromDescription(
    @Body() dto: BuildFormFromDescriptionDto,
    @CurrentUser() actor: AuthenticatedUser
  ): Promise<BuildFormFromDescriptionResponseDto> {
    return this.describer.buildFromDescription(actor.sub, dto.description);
  }

  @Post("templates/draft-rule")
  @RequirePermissions("forms.manage")
  @ApiOperation({
    summary: "Draft a condition/action rule tree from a plain-language description",
    description:
      "Accepts a plain-language rule description and the current form's field list. Returns a drafted FieldRule condition/action tree for review in the rules builder. The returned draft is NEVER persisted or enabled -- the human must click Save rules in the builder. Requires forms.manage."
  })
  @ApiResponse({
    status: 201,
    description: "Drafted FieldRule object (never saved automatically)."
  })
  @ApiResponse({ status: 400, description: "Description or field list missing/invalid." })
  @ApiResponse({ status: 403, description: "Missing forms.manage permission." })
  @ApiResponse({ status: 503, description: "AI provider not configured or upstream error." })
  async draftRule(
    @Body() dto: DraftRuleDto,
    @CurrentUser() actor: AuthenticatedUser
  ): Promise<FieldRule> {
    return this.ruleDrafter.draftRule(actor.sub, dto.ruleDescription, dto.fields);
  }
}
