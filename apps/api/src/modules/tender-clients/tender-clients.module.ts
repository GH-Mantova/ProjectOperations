import { Module } from "@nestjs/common";
import { TenderClientSearchController, TenderClientsController } from "./tender-clients.controller";
import { TenderClientsService } from "./tender-clients.service";

@Module({
  controllers: [TenderClientsController, TenderClientSearchController],
  providers: [TenderClientsService],
  exports: [TenderClientsService]
})
export class TenderClientsModule {}
