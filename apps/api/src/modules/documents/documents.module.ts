import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { PlatformModule } from "../platform/platform.module";
import { DocumentsController } from "./documents.controller";
import { DocumentsService } from "./documents.service";

@Module({
  imports: [AuditModule, PlatformModule],
  controllers: [DocumentsController],
  providers: [DocumentsService],
  exports: [DocumentsService]
})
export class DocumentsModule {}
