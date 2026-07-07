import { Module } from "@nestjs/common";
import { ListBindingsController } from "./list-bindings.controller";
import { ListBindingsService } from "./list-bindings.service";

@Module({
  controllers: [ListBindingsController],
  providers: [ListBindingsService],
  exports: [ListBindingsService]
})
export class ListBindingsModule {}
