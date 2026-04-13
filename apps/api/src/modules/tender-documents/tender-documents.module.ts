import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { PlatformModule } from "../platform/platform.module";
import { TenderDocumentsController } from "./tender-documents.controller";
import { TenderDocumentsService } from "./tender-documents.service";

@Module({
  imports: [AuditModule, PlatformModule],
  controllers: [TenderDocumentsController],
  providers: [TenderDocumentsService],
  exports: [TenderDocumentsService]
})
export class TenderDocumentsModule {}
