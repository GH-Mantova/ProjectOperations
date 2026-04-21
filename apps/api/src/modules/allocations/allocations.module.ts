import { Module } from "@nestjs/common";
import { PlatformModule } from "../platform/platform.module";
import { AllocationsController } from "./allocations.controller";
import { AllocationsService } from "./allocations.service";

@Module({
  imports: [PlatformModule],
  controllers: [AllocationsController],
  providers: [AllocationsService]
})
export class AllocationsModule {}
