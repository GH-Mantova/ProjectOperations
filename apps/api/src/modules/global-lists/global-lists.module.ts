import { Module } from "@nestjs/common";
import { GlobalListsController } from "./global-lists.controller";
import { GlobalListsService } from "./global-lists.service";

@Module({
  controllers: [GlobalListsController],
  providers: [GlobalListsService],
  exports: [GlobalListsService]
})
export class GlobalListsModule {}
