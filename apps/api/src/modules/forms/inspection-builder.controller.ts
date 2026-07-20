import {
  BadRequestException,
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
import { BuildFormFromPdfResponseDto } from "./dto/inspection-builder.dto";
import { InspectionBuilderService } from "./inspection-builder.service";

// 10 MB — comfortably fits a multi-page A4 checklist scanned as PDF, and
// well under the 25 MB cap Anthropic imposes on document uploads. Rejects
// oversized files at the multer layer so we never buffer a 500 MB blob
// just to fail parse.
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

/**
 * `POST /forms/templates/build-from-pdf` — accepts a multipart PDF upload
 * and returns the id of a freshly-created **DRAFT** template.
 *
 * The endpoint requires `forms.manage`, same as `POST /forms/templates`,
 * because the outcome is a new template row that shows up in every user's
 * template picker. It ALSO requires the caller (or the company) to have
 * an AI provider key configured — resolved lazily by AiProvidersService.
 */
@ApiTags("Forms")
@ApiBearerAuth()
@Controller("forms")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class InspectionBuilderController {
  constructor(private readonly builder: InspectionBuilderService) {}

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
      "Extracts text from the uploaded PDF, calls the caller's configured AI provider (BYOK via AiProvidersService — same key store as the assist panel) to derive sections + fields, and creates a DRAFT FormTemplate. Never publishes the template — the user must open it in the designer and press publish. Requires forms.manage."
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
}
