import { Module } from "@nestjs/common";
import { PlatformModule } from "../platform/platform.module";
import { FieldController } from "./field.controller";
import { FieldService } from "./field.service";
import { DocketService } from "./docket.service";

@Module({
  imports: [PlatformModule],
  controllers: [FieldController],
  providers: [FieldService, DocketService]
})
export class FieldModule {}
