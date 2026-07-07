import { Module } from "@nestjs/common";
import { TenderClientSearchController, TenderClientsController } from "./tender-clients.controller";
import { TenderClientsService } from "./tender-clients.service";
import { TenderPackagesController } from "./tender-packages.controller";
import { TenderPackagesService } from "./tender-packages.service";

@Module({
  controllers: [TenderClientsController, TenderClientSearchController, TenderPackagesController],
  providers: [TenderClientsService, TenderPackagesService],
  exports: [TenderClientsService, TenderPackagesService]
})
export class TenderClientsModule {}
