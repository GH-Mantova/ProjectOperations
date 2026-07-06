import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { TenderPricingBasis } from "@prisma/client";
import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf
} from "class-validator";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { TenderPackagesService } from "./tender-packages.service";

class AddPackageDto {
  @IsString() disciplineItemId!: string;
}

class AttachCellDto {
  @IsString() tenderClientId!: string;
  @IsString() tenderPackageId!: string;
  @IsOptional() @IsEnum(TenderPricingBasis) pricingBasis?: TenderPricingBasis;
  @IsOptional() @IsString() @MaxLength(2000) basisNote?: string;
}

class UpdateCellDto {
  @IsOptional() @IsEnum(TenderPricingBasis) pricingBasis?: TenderPricingBasis;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsString() @MaxLength(2000)
  basisNote?: string | null;
}

class SetSubmissionDateDto {
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsDateString()
  submissionDate?: string | null;
}

@ApiTags("Tender Packages")
@ApiBearerAuth()
@Controller("tenders/:tenderId")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class TenderPackagesController {
  constructor(private readonly service: TenderPackagesService) {}

  @Get("packages")
  @RequirePermissions("tenders.view")
  @ApiOperation({ summary: "List packages selected on a tender." })
  @ApiResponse({ status: 200, description: "Packages on the tender." })
  listPackages(@Param("tenderId") tenderId: string) {
    return this.service.listPackages(tenderId);
  }

  @Post("packages")
  @RequirePermissions("tenders.manage")
  @ApiOperation({ summary: "Add a package (discipline) to the tender." })
  @ApiResponse({ status: 404, description: "Tender or discipline not found." })
  @ApiResponse({ status: 409, description: "Package already on this tender." })
  addPackage(@Param("tenderId") tenderId: string, @Body() dto: AddPackageDto) {
    return this.service.addPackage(tenderId, dto.disciplineItemId);
  }

  @Delete("packages/:packageId")
  @RequirePermissions("tenders.manage")
  @ApiOperation({ summary: "Remove a package from the tender (cascades matrix cells)." })
  @ApiResponse({ status: 404, description: "Package not found on this tender." })
  removePackage(
    @Param("tenderId") tenderId: string,
    @Param("packageId") packageId: string
  ) {
    return this.service.removePackage(tenderId, packageId);
  }

  @Get("matrix")
  @RequirePermissions("tenders.view")
  @ApiOperation({ summary: "List the builder × package matrix cells for a tender." })
  @ApiResponse({ status: 200, description: "Matrix cells." })
  listMatrix(@Param("tenderId") tenderId: string) {
    return this.service.listMatrix(tenderId);
  }

  @Post("matrix")
  @RequirePermissions("tenders.manage")
  @ApiOperation({ summary: "Attach a client to a package (matrix cell) with pricing basis." })
  @ApiResponse({ status: 400, description: "Client and package must be on the same tender." })
  @ApiResponse({ status: 404, description: "Tender, client, or package not found." })
  @ApiResponse({ status: 409, description: "Cell already exists." })
  attachCell(@Param("tenderId") tenderId: string, @Body() dto: AttachCellDto) {
    return this.service.attachCell(
      tenderId,
      dto.tenderClientId,
      dto.tenderPackageId,
      dto.pricingBasis,
      dto.basisNote
    );
  }

  @Patch("matrix/:cellId")
  @RequirePermissions("tenders.manage")
  @ApiOperation({ summary: "Update pricing basis and/or basis note on a matrix cell." })
  @ApiResponse({ status: 404, description: "Cell not found on this tender." })
  updateCell(
    @Param("tenderId") tenderId: string,
    @Param("cellId") cellId: string,
    @Body() dto: UpdateCellDto
  ) {
    return this.service.updateCell(tenderId, cellId, dto.pricingBasis, dto.basisNote);
  }

  @Delete("matrix/:cellId")
  @RequirePermissions("tenders.manage")
  @ApiOperation({ summary: "Detach a client from a package (delete the matrix cell)." })
  @ApiResponse({ status: 404, description: "Cell not found on this tender." })
  detachCell(@Param("tenderId") tenderId: string, @Param("cellId") cellId: string) {
    return this.service.detachCell(tenderId, cellId);
  }

  @Patch("clients/:tenderClientId/submission-date")
  @RequirePermissions("tenders.manage")
  @ApiOperation({ summary: "Set (or clear) a tender client's submission date." })
  @ApiResponse({ status: 404, description: "Tender client not found on this tender." })
  setSubmissionDate(
    @Param("tenderId") tenderId: string,
    @Param("tenderClientId") tenderClientId: string,
    @Body() dto: SetSubmissionDateDto
  ) {
    const date = dto.submissionDate == null ? null : new Date(dto.submissionDate);
    return this.service.setSubmissionDate(tenderId, tenderClientId, date);
  }

  @Get("document-buckets")
  @RequirePermissions("tenders.view")
  @ApiOperation({
    summary:
      "Derived: union of packages selected by any client on the tender. Feeds the single deduplicated document upload."
  })
  @ApiResponse({ status: 200, description: "Union of packages across all clients." })
  documentBuckets(@Param("tenderId") tenderId: string) {
    return this.service.documentBuckets(tenderId);
  }
}
