import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { CreateTenderDocumentDto } from "./dto/tender-document.dto";
import { TenderDocumentsService } from "./tender-documents.service";

@ApiTags("Tender Documents")
@ApiBearerAuth()
@Controller("tenders/:tenderId/documents")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class TenderDocumentsController {
  constructor(private readonly service: TenderDocumentsService) {}

  @Get()
  @RequirePermissions("tenderdocuments.view")
  @ApiOperation({ summary: "List tender documents" })
  @ApiResponse({ status: 200, description: "List tender documents." })
  list(@Param("tenderId") tenderId: string) {
    return this.service.list(tenderId);
  }

  @Post()
  @RequirePermissions("tenderdocuments.manage")
  @UseInterceptors(FileInterceptor("file"))
  @ApiConsumes("multipart/form-data", "application/json")
  @ApiOperation({ summary: "Create a tender-linked document (optional multipart file upload)" })
  @ApiResponse({ status: 201, description: "Create a tender-linked document (optional multipart file upload)." })
  create(
    @Param("tenderId") tenderId: string,
    @Body() dto: CreateTenderDocumentDto,
    @CurrentUser() actor: { sub: string },
    @UploadedFile() file?: Express.Multer.File
  ) {
    return this.service.create(tenderId, dto, actor.sub, file);
  }

  @Delete(":documentId")
  @RequirePermissions("tenderdocuments.manage")
  @ApiOperation({ summary: "Delete a tender-linked document (removes the DB row; SharePoint file is left in place)" })
  @ApiResponse({ status: 200, description: "Delete a tender-linked document (removes the DB row; SharePoint file is left in place)." })
  remove(
    @Param("tenderId") tenderId: string,
    @Param("documentId") documentId: string,
    @CurrentUser() actor: { sub: string }
  ) {
    return this.service.remove(tenderId, documentId, actor.sub);
  }
}
