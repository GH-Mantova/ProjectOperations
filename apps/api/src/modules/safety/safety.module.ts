import { Module } from "@nestjs/common";
import { EmailModule } from "../email/email.module";
import { PlatformModule } from "../platform/platform.module";
import { SafetyController } from "./safety.controller";
import { SafetyService } from "./safety.service";

@Module({
  imports: [PlatformModule, EmailModule],
  controllers: [SafetyController],
  providers: [SafetyService],
  exports: [SafetyService]
})
export class SafetyModule {}
