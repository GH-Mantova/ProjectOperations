import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
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
  DraftRuleDto,
  PreviewImportCreateDto,
  PreviewImportCreateResponseDto,
  PreviewImportResponseDto
} from "./dto/inspection-builder.dto";
import { InspectionBuilderService, ACCEPTED_MIMETYPES } from "./inspection-builder.service";
import { AiFormDescribeService } from "./ai-form-describe.service";
import { AiRuleDraftService } from "./ai-rule-draft.service";
import type { FieldRule } from "@project-ops/config/forms-rule-definition";

// 10 MB -- comfortably fits a multi-page A4 checklist scanned as PDF, and
// well under the 25 MB cap Anthropic imposes on document uploads. Rejects
// oversized files at the multer layer so we never buffer a 500 MB blob
// just to fail parse.
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

// ACCEPTED_MIMETYPES (imported from service) contains:
//   - application/pdf
//   - application/vnd.openxmlformats-officedocument.wordprocessingml.document

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
 * FV2-S2 -- three-step preview-import flow:
 * `POST /forms/templates/preview-import` -- extract + AI, hold in TTL store.
 * `GET /forms/templates/preview-import/:jobId` -- retrieve held proposal.
 * `POST /forms/templates/preview-import/:jobId/create` -- create DRAFT from reviewed proposal.
 *
 * All endpoints require `forms.manage`. Provider resolution uses the
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
      limits: { fileSize: MAX_UPLOAD_BYTES },
      fileFilter: (
        _req: unknown,
        file: Express.Multer.File,
        cb: (err: Error | null, accept: boolean) => void
      ) => {
        if (ACCEPTED_MIMETYPES.has(file.mimetype)) {
          cb(null, true);
        } else {
          cb(
            new BadRequestException(
              `Unsupported file type: ${file.mimetype}. Upload a PDF or Word (.docx) document.`
            ),
            false
          );
        }
      }
    })
  )
  @ApiConsumes("multipart/form-data")
  @ApiOperation({
    summary: "Build a DRAFT form template from an uploaded PDF or Word document",
    description:
      "Extracts text from the uploaded PDF or Word (.docx) document, calls the caller's configured AI provider (BYOK via AiProvidersService -- same key store as the assist panel) to derive sections + fields, and creates a DRAFT FormTemplate. Never publishes the template -- the user must open it in the designer and press publish. Requires forms.manage. Route name is intentionally preserved for backwards compatibility."
  })
  @ApiResponse({ status: 201, description: "Draft form template created.", type: BuildFormFromPdfResponseDto })
  @ApiResponse({ status: 400, description: "Missing/invalid file, unsupported type, or PDF has no text layer (scanned)." })
  @ApiResponse({ status: 403, description: "Missing forms.manage permission." })
  @ApiResponse({ status: 503, description: "AI provider not configured or upstream error." })
  async buildFromPdf(
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentUser() actor: AuthenticatedUser
  ): Promise<BuildFormFromPdfResponseDto> {
    if (!file) {
      throw new BadRequestException("Upload a PDF or Word (.docx) file in the `file` multipart field.");
    }
    return this.builder.buildFromPdf(file, actor.sub);
  }

  // ── FV2-S2: Preview-import endpoints ───────────────────────────────────

  @Post("templates/preview-import")
  @RequirePermissions("forms.manage")
  @UseInterceptors(
    FileInterceptor("file", {
      limits: { fileSize: MAX_UPLOAD_BYTES },
      fileFilter: (
        _req: unknown,
        file: Express.Multer.File,
        cb: (err: Error | null, accept: boolean) => void
      ) => {
        if (ACCEPTED_MIMETYPES.has(file.mimetype)) {
          cb(null, true);
        } else {
          cb(
            new BadRequestException(
              `Unsupported file type: ${file.mimetype}. Upload a PDF or Word (.docx) document.`
            ),
            false
          );
        }
      }
    })
  )
  @ApiConsumes("multipart/form-data")
  @ApiOperation({
    summary: "Extract and propose a form template without creating it (step 1 of 3)",
    description:
      "Extracts text from the uploaded document, calls the AI provider, and returns a proposal held in a 30-minute TTL in-memory store. The caller navigates to /forms/import/:jobId for review. No template is created at this step."
  })
  @ApiResponse({ status: 201, description: "Extraction and proposal returned.", type: PreviewImportResponseDto })
  @ApiResponse({ status: 400, description: "Missing/invalid file, unsupported type, or no text layer." })
  @ApiResponse({ status: 403, description: "Missing forms.manage permission." })
  @ApiResponse({ status: 503, description: "AI provider not configured or upstream error." })
  async previewImport(
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentUser() actor: AuthenticatedUser
  ): Promise<PreviewImportResponseDto> {
    if (!file) {
      throw new BadRequestException("Upload a PDF or Word (.docx) file in the `file` multipart field.");
    }
    return this.builder.previewImport(file, actor.sub);
  }

  @Get("templates/preview-import/:jobId")
  @RequirePermissions("forms.manage")
  @ApiOperation({
    summary: "Retrieve a held import proposal by jobId (step 2 of 3)",
    description:
      "Returns the proposal created by POST /forms/templates/preview-import. Returns 404 when the job has expired (30-minute TTL) or does not exist."
  })
  @ApiResponse({ status: 200, description: "Proposal retrieved.", type: PreviewImportResponseDto })
  @ApiResponse({ status: 403, description: "Missing forms.manage permission." })
  @ApiResponse({ status: 404, description: "Job not found or expired." })
  getPreviewImport(
    @Param("jobId") jobId: string
  ): PreviewImportResponseDto {
    return this.builder.getPreviewImport(jobId);
  }

  @Post("templates/preview-import/:jobId/create")
  @RequirePermissions("forms.manage")
  @ApiOperation({
    summary: "Create a DRAFT template from the reviewed proposal (step 3 of 3)",
    description:
      "Accepts the reviewer's edited UpsertFormTemplateDto (rejected rows already removed by the client), creates a DRAFT template, and returns the template id. `code` is honoured as sent; a collision produces 409. The template is always created as DRAFT regardless of the `status` field in the payload."
  })
  @ApiResponse({ status: 201, description: "DRAFT template created.", type: PreviewImportCreateResponseDto })
  @ApiResponse({ status: 400, description: "Invalid proposal payload." })
  @ApiResponse({ status: 403, description: "Missing forms.manage permission." })
  @ApiResponse({ status: 409, description: "Template code collision." })
  async createFromPreview(
    @Param("jobId") jobId: string,
    @Body() body: PreviewImportCreateDto,
    @CurrentUser() actor: AuthenticatedUser
  ): Promise<PreviewImportCreateResponseDto> {
    return this.builder.createFromPreview(jobId, body.proposal, actor.sub);
  }

  // ── Existing endpoints ──────────────────────────────────────────────────

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
