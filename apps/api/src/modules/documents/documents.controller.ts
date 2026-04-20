import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import type { AuthenticatedUser } from "../../common/auth/authenticated-request.interface";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import {
  CreateDocumentDto,
  CreateDocumentVersionDto,
  DocumentsQueryDto
} from "./dto/documents.dto";
import { DocumentsService } from "./documents.service";

@ApiTags("Documents")
@ApiBearerAuth()
@Controller("documents")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class DocumentsController {
  constructor(private readonly service: DocumentsService) {}

  @Get()
  @RequirePermissions("documents.view")
  @ApiOperation({ summary: "List SharePoint-backed documents with filters and access checks" })
  list(@Query() query: DocumentsQueryDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.service.list(query, actor);
  }

  @Get("entity/:linkedEntityType/:linkedEntityId")
  @RequirePermissions("documents.view")
  @ApiOperation({ summary: "List documents linked to a specific entity" })
  listForEntity(
    @Param("linkedEntityType") linkedEntityType: string,
    @Param("linkedEntityId") linkedEntityId: string,
    @CurrentUser() actor: AuthenticatedUser
  ) {
    return this.service.listForEntity(linkedEntityType, linkedEntityId, actor);
  }

  @Get(":id")
  @RequirePermissions("documents.view")
  @ApiOperation({ summary: "Get document detail with version history and access rules" })
  getById(@Param("id") id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.service.getById(id, actor);
  }

  @Get(":id/open-link")
  @RequirePermissions("documents.view")
  @ApiOperation({ summary: "Get open-link URL for a document" })
  getOpenLink(@Param("id") id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.service.getOpenLink(id, actor);
  }

  @Get(":id/download")
  @RequirePermissions("documents.view")
  @ApiOperation({ summary: "Get download URL for a document" })
  getDownloadLink(@Param("id") id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.service.getDownloadLink(id, actor);
  }

  @Post()
  @RequirePermissions("documents.manage")
  @UseInterceptors(FileInterceptor("file"))
  @ApiConsumes("multipart/form-data", "application/json")
  @ApiOperation({ summary: "Create and register a SharePoint-backed document link (optional multipart file upload)" })
  create(
    @Body() dto: CreateDocumentDto,
    @CurrentUser() actor: AuthenticatedUser,
    @UploadedFile() file?: Express.Multer.File
  ) {
    return this.service.create(dto, actor, file);
  }

  @Post(":id/versions")
  @RequirePermissions("documents.manage")
  @UseInterceptors(FileInterceptor("file"))
  @ApiConsumes("multipart/form-data", "application/json")
  @ApiOperation({ summary: "Create a new version of an existing document (optional multipart file upload)" })
  createVersion(
    @Param("id") id: string,
    @Body() dto: CreateDocumentVersionDto,
    @CurrentUser() actor: AuthenticatedUser,
    @UploadedFile() file?: Express.Multer.File
  ) {
    return this.service.createVersion(id, dto, actor, file);
  }
}
