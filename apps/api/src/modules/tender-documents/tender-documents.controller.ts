import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
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
  list(@Param("tenderId") tenderId: string) {
    return this.service.list(tenderId);
  }

  @Post()
  @RequirePermissions("tenderdocuments.manage")
  @ApiOperation({ summary: "Create a tender-linked document using the SharePoint foundation" })
  create(
    @Param("tenderId") tenderId: string,
    @Body() dto: CreateTenderDocumentDto,
    @CurrentUser() actor: { sub: string }
  ) {
    return this.service.create(tenderId, dto, actor.sub);
  }
}
