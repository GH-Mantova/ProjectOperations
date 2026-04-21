import { Module } from "@nestjs/common";
import { TenderClarificationsController } from "./tender-clarifications.controller";
import { TenderClarificationsService } from "./tender-clarifications.service";

@Module({
  controllers: [TenderClarificationsController],
  providers: [TenderClarificationsService],
  exports: [TenderClarificationsService]
})
export class TenderClarificationsModule {}
