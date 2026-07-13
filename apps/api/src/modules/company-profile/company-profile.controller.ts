import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { CompanyLegalDocumentType } from "@prisma/client";
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength
} from "class-validator";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import type { AuthenticatedRequest } from "../../common/auth/authenticated-request.interface";
import { CompanyProfileService } from "./company-profile.service";

// ─── DTOs ────────────────────────────────────────────────────────────────
class UpdateCompanyProfileDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(200) legalName?: string;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(200) tradingName?: string;
  @IsOptional() @IsString() @MaxLength(20) abn?: string | null;
  @IsOptional() @IsString() @MaxLength(20) acn?: string | null;
  @IsOptional() @IsIn(["PTY_LTD", "SOLE_TRADER", "PARTNERSHIP", "TRUST", "OTHER"])
  entityType?: "PTY_LTD" | "SOLE_TRADER" | "PARTNERSHIP" | "TRUST" | "OTHER";

  @IsOptional() @IsString() @MaxLength(200) primaryEmail?: string | null;
  @IsOptional() @IsString() @MaxLength(50) primaryPhone?: string | null;
  @IsOptional() @IsString() @MaxLength(500) website?: string | null;
  @IsOptional() @IsString() @MaxLength(200) registeredAddressLine1?: string | null;
  @IsOptional() @IsString() @MaxLength(200) registeredAddressLine2?: string | null;
  @IsOptional() @IsString() @MaxLength(100) registeredSuburb?: string | null;
  @IsOptional() @IsString() @MaxLength(50) registeredState?: string | null;
  @IsOptional() @IsString() @MaxLength(20) registeredPostcode?: string | null;
  @IsOptional() @IsString() @MaxLength(100) registeredCountry?: string;
  @IsOptional() @IsString() @MaxLength(200) postalAddressLine1?: string | null;
  @IsOptional() @IsString() @MaxLength(200) postalAddressLine2?: string | null;
  @IsOptional() @IsString() @MaxLength(100) postalSuburb?: string | null;
  @IsOptional() @IsString() @MaxLength(50) postalState?: string | null;
  @IsOptional() @IsString() @MaxLength(20) postalPostcode?: string | null;
  @IsOptional() @IsString() @MaxLength(100) postalCountry?: string;
  @IsOptional() @IsString() whsOfficerUserId?: string | null;
  @IsOptional() @IsString() @MaxLength(200) emergencyContactName?: string | null;
  @IsOptional() @IsString() @MaxLength(50) emergencyContactPhone?: string | null;

  @IsOptional() @IsNumber() @Min(0) @Max(100) gstRate?: number;
  @IsOptional() @IsString() @MaxLength(3) currency?: string;
  @IsOptional() @IsInt() @Min(1) @Max(12) financialYearStartMonth?: number;
  @IsOptional() @IsString() @MaxLength(100) timezone?: string;
  @IsOptional() @IsInt() @Min(0) @Max(365) defaultPaymentTermsDays?: number;
  @IsOptional() @IsInt() @Min(0) @Max(365) defaultQuoteValidityDays?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(100) defaultMarkupPercent?: number;

  @IsOptional() @IsString() @MaxLength(10) tenderNumberPrefix?: string;
  @IsOptional() @IsString() @MaxLength(10) quoteNumberPrefix?: string;
  @IsOptional() @IsString() @MaxLength(10) jobNumberPrefix?: string;
  @IsOptional() @IsString() @MaxLength(10) projectNumberPrefix?: string;
  @IsOptional() @IsString() @MaxLength(10) variationNumberPrefix?: string;
  @IsOptional() @IsString() @MaxLength(10) claimNumberPrefix?: string;
  @IsOptional() @IsString() @MaxLength(10) incidentNumberPrefix?: string;

  @IsOptional() @IsString() @MaxLength(9) primaryColorHex?: string;
  @IsOptional() @IsString() @MaxLength(9) secondaryColorHex?: string;
  @IsOptional() @IsString() @MaxLength(1000) logoLightUrl?: string | null;
  @IsOptional() @IsString() @MaxLength(1000) logoDarkUrl?: string | null;
  @IsOptional() @IsString() @MaxLength(1000) faviconUrl?: string | null;
  @IsOptional() @IsString() @MaxLength(1000) pdfLetterheadUrl?: string | null;
}

class CreateLegalDocumentDto {
  @IsIn([
    "TERMS_AND_CONDITIONS",
    "COVER_LETTER",
    "STANDARD_ASSUMPTIONS",
    "STANDARD_EXCLUSIONS",
    "PROJECT_ALLOWANCES",
    "PRIVACY_NOTICE"
  ])
  type!: CompanyLegalDocumentType;

  @IsString() @MinLength(1) content!: string;

  @IsOptional() @IsDateString() effectiveFrom?: string;
}

class LicenceDto {
  @IsString() @MaxLength(100) licenceType!: string;
  @IsOptional() @IsString() @MaxLength(200) licenceNumber?: string | null;
  @IsOptional() @IsString() @MaxLength(200) issuingAuthority?: string | null;
  @IsOptional() @IsDateString() issueDate?: string;
  @IsOptional() @IsDateString() expiryDate?: string;
  @IsOptional() @IsString() @MaxLength(500) documentPath?: string | null;
  @IsOptional() @IsString() notes?: string | null;
  @IsOptional() @IsString() status?: string;
}

class InsuranceDto {
  @IsString() @MaxLength(100) insuranceType!: string;
  @IsOptional() @IsString() @MaxLength(200) insurerName?: string | null;
  @IsOptional() @IsString() @MaxLength(200) policyNumber?: string | null;
  @IsOptional() @IsNumber() coverageAmount?: number | null;
  @IsOptional() @IsDateString() expiryDate?: string;
  @IsOptional() @IsString() @MaxLength(500) documentPath?: string | null;
  @IsOptional() @IsString() notes?: string | null;
  @IsOptional() @IsString() status?: string;
}

@ApiTags("Company Profile")
@ApiBearerAuth()
@Controller("admin/company")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class CompanyProfileController {
  constructor(private readonly service: CompanyProfileService) {}

  @Get("profile")
  @RequirePermissions("platform.admin")
  @ApiOperation({ summary: "Read the company profile singleton + completeness indicator." })
  getProfile() {
    return this.service.getProfile();
  }

  @Patch("profile")
  @RequirePermissions("platform.admin")
  @ApiOperation({
    summary:
      "Partial update of the company profile. Super-user only (enforced server-side, not just UI)."
  })
  updateProfile(@Body() dto: UpdateCompanyProfileDto, @Req() req: AuthenticatedRequest) {
    this.service.assertSuperUser(req.user);
    return this.service.updateProfile(req.user!.sub, dto);
  }

  // ─── Legal documents ──────────────────────────────────────────────────
  @Get("legal-documents")
  @RequirePermissions("platform.admin")
  @ApiOperation({ summary: "List all versions of all legal-document types (newest first per type)." })
  listLegalDocuments() {
    return this.service.listLegalDocuments();
  }

  @Post("legal-documents")
  @RequirePermissions("platform.admin")
  @ApiOperation({
    summary:
      "Create a NEW version of a legal document. The previous active version (if any) is closed. Old versions are never mutated — they may be pinned by historical quotes/contracts."
  })
  createLegalDocumentVersion(
    @Body() dto: CreateLegalDocumentDto,
    @Req() req: AuthenticatedRequest
  ) {
    this.service.assertSuperUser(req.user);
    return this.service.createLegalDocumentVersion(req.user!.sub, {
      type: dto.type,
      content: dto.content,
      effectiveFrom: dto.effectiveFrom ? new Date(dto.effectiveFrom) : undefined
    });
  }

  // ─── Company licences ─────────────────────────────────────────────────
  @Get("licences")
  @RequirePermissions("platform.admin")
  @ApiOperation({ summary: "List company-owned licences (demolition, asbestos, QBCC, waste transport). Same expiry-alert path as subcontractors." })
  listLicences() {
    return this.service.listLicences();
  }

  @Post("licences")
  @RequirePermissions("platform.admin")
  @ApiOperation({ summary: "Create a new company-owned licence. Super-user only." })
  createLicence(@Body() dto: LicenceDto, @Req() req: AuthenticatedRequest) {
    this.service.assertSuperUser(req.user);
    return this.service.createLicence(req.user!.sub, {
      ...dto,
      issueDate: dto.issueDate ? new Date(dto.issueDate) : null,
      expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : null
    });
  }

  @Patch("licences/:id")
  @RequirePermissions("platform.admin")
  @ApiOperation({ summary: "Update a company-owned licence (renew, change number/issuer/expiry). Super-user only." })
  updateLicence(
    @Param("id") id: string,
    @Body() dto: Partial<LicenceDto> & { issueDate?: string; expiryDate?: string },
    @Req() req: AuthenticatedRequest
  ) {
    this.service.assertSuperUser(req.user);
    return this.service.updateLicence(req.user!.sub, id, {
      ...dto,
      issueDate: dto.issueDate ? new Date(dto.issueDate) : undefined,
      expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : undefined
    });
  }

  @Delete("licences/:id")
  @RequirePermissions("platform.admin")
  @ApiOperation({ summary: "Delete a company-owned licence. Super-user only." })
  async deleteLicence(@Param("id") id: string, @Req() req: AuthenticatedRequest) {
    this.service.assertSuperUser(req.user);
    await this.service.deleteLicence(req.user!.sub, id);
    return { ok: true };
  }

  // ─── Company insurances ───────────────────────────────────────────────
  @Get("insurances")
  @RequirePermissions("platform.admin")
  @ApiOperation({ summary: "List company-owned insurances (public liability, workers comp, professional indemnity)." })
  listInsurances() {
    return this.service.listInsurances();
  }

  @Post("insurances")
  @RequirePermissions("platform.admin")
  @ApiOperation({ summary: "Create a new company-owned insurance policy. Super-user only." })
  createInsurance(@Body() dto: InsuranceDto, @Req() req: AuthenticatedRequest) {
    this.service.assertSuperUser(req.user);
    return this.service.createInsurance(req.user!.sub, {
      ...dto,
      expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : null
    });
  }

  @Patch("insurances/:id")
  @RequirePermissions("platform.admin")
  @ApiOperation({ summary: "Update a company-owned insurance policy (renew, update policy/expiry). Super-user only." })
  updateInsurance(
    @Param("id") id: string,
    @Body() dto: Partial<InsuranceDto> & { expiryDate?: string },
    @Req() req: AuthenticatedRequest
  ) {
    this.service.assertSuperUser(req.user);
    return this.service.updateInsurance(req.user!.sub, id, {
      ...dto,
      expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : undefined
    });
  }

  @Delete("insurances/:id")
  @RequirePermissions("platform.admin")
  @ApiOperation({ summary: "Delete a company-owned insurance policy. Super-user only." })
  async deleteInsurance(@Param("id") id: string, @Req() req: AuthenticatedRequest) {
    this.service.assertSuperUser(req.user);
    await this.service.deleteInsurance(req.user!.sub, id);
    return { ok: true };
  }
}
