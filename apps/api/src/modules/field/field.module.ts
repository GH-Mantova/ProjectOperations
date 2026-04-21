import { Module } from "@nestjs/common";
import { PlatformModule } from "../platform/platform.module";
import { FieldController } from "./field.controller";
import { FieldService } from "./field.service";

@Module({
  imports: [PlatformModule],
  controllers: [FieldController],
  providers: [FieldService]
})
export class FieldModule {}
