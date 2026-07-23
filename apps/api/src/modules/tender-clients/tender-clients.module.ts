import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { TenderClientSearchController, TenderClientsController } from "./tender-clients.controller";
import { TenderClientsService } from "./tender-clients.service";
import { TenderPackagesController } from "./tender-packages.controller";
import { TenderPackagesService } from "./tender-packages.service";

@Module({
  imports: [AuditModule],
  controllers: [TenderClientsController, TenderClientSearchController, TenderPackagesController],
  providers: [TenderClientsService, TenderPackagesService],
  exports: [TenderClientsService, TenderPackagesService]
})
export class TenderClientsModule {}
