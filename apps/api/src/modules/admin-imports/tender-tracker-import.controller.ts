/**
 * MIG-2 + MIG-3 — Tender-tracker import controller.
 *
 * POST /admin/imports/tender-tracker       — MIG-2: import tracker CSV/XLSX
 * POST /admin/imports/sharepoint-legacy-copy/plan    — MIG-3: dry-run match report
 * POST /admin/imports/sharepoint-legacy-copy/execute — MIG-3: commit copy job
 *
 * Guards: JwtAuthGuard + PermissionsGuard with "users.create" permission
 * reused from admin-users (the existing super-user surface).  No new
 * permission code is introduced — the spec says "reuse whatever
 * admin-users.controller.ts uses" and admin-users gates creation on
 * "users.create" which is already super-user-only in practice.
 *
 * File upload (tender-tracker only): multipart/form-data, field name "file".
 * Body field: dryRun (string "true" | "false").
 */

import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { PrismaService } from "../../prisma/prisma.service";
import { TenderTrackerImportService } from "./tender-tracker-import.service";
import { SharepointLegacyCopyService } from "./sharepoint-legacy-copy.service";

@ApiTags("Admin Imports")
@ApiBearerAuth()
@Controller("admin/imports")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class TenderTrackerImportController {
  constructor(
    private readonly service: TenderTrackerImportService,
    private readonly legacyCopy: SharepointLegacyCopyService,
    private readonly prisma: PrismaService
  ) {}

  // ---------------------------------------------------------------------------
  // MIG-2: Tender-tracker import
  // ---------------------------------------------------------------------------

  @Post("tender-tracker")
  @RequirePermissions("users.create") // super-user gate — same code as admin-users
  @ApiOperation({
    summary:
      "Import legacy estimating tracker (CSV or XLSX). dryRun=true validates only; dryRun=false commits idempotently.",
  })
  @ApiConsumes("multipart/form-data")
  @ApiResponse({ status: 201, description: "Import report returned." })
  @ApiResponse({ status: 400, description: "Bad file or parse error." })
  @ApiResponse({ status: 403, description: "Super-user access required." })
  @UseInterceptors(FileInterceptor("file"))
  async importTenderTracker(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body("dryRun") dryRunRaw: string | undefined,
    @CurrentUser() actor: { sub: string; isSuperUser?: boolean }
  ) {
    // Extra defence-in-depth: ensure caller is a super-user, since this
    // endpoint writes production Tender/Client/Site rows.
    const user = await this.prisma.user.findUnique({
      where: { id: actor.sub },
      select: { isSuperUser: true },
    });
    if (!user?.isSuperUser) {
      throw new ForbiddenException("Super-user access required for tender tracker import.");
    }

    if (!file) {
      throw new BadRequestException("No file uploaded. Send a multipart/form-data request with field name 'file'.");
    }

    const dryRun = dryRunRaw !== "false"; // default to dry-run for safety

    return this.service.import(
      file.buffer,
      file.originalname,
      file.mimetype,
      dryRun,
      actor.sub
    );
  }

  // ---------------------------------------------------------------------------
  // MIG-3: SharePoint legacy-folder copy — dry-run plan
  // ---------------------------------------------------------------------------

  @Post("sharepoint-legacy-copy/plan")
  @RequirePermissions("users.create") // super-user gate — same as tender-tracker import
  @ApiOperation({
    summary:
      "MIG-3 dry-run: list match candidates between legacy SharePoint folders and ERP tenders. No files are copied.",
  })
  @ApiResponse({ status: 201, description: "LegacyCopyPlan returned." })
  @ApiResponse({ status: 403, description: "Super-user access required." })
  async sharepointLegacyCopyPlan(
    @CurrentUser() actor: { sub: string; isSuperUser?: boolean }
  ) {
    await this.assertSuperUser(actor.sub);
    return this.legacyCopy.plan();
  }

  // ---------------------------------------------------------------------------
  // MIG-3: SharePoint legacy-folder copy — execute
  // ---------------------------------------------------------------------------

  @Post("sharepoint-legacy-copy/execute")
  @RequirePermissions("users.create") // super-user gate — same as tender-tracker import
  @ApiOperation({
    summary:
      "MIG-3 commit: copy legacy SharePoint folder contents to ERP-created folders. Idempotent — already-present files are skipped.",
  })
  @ApiResponse({ status: 201, description: "LegacyCopyExecutionReport returned." })
  @ApiResponse({ status: 403, description: "Super-user access required." })
  async sharepointLegacyCopyExecute(
    @CurrentUser() actor: { sub: string; isSuperUser?: boolean }
  ) {
    await this.assertSuperUser(actor.sub);
    return this.legacyCopy.execute();
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private async assertSuperUser(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { isSuperUser: true },
    });
    if (!user?.isSuperUser) {
      throw new ForbiddenException("Super-user access required.");
    }
  }
}
