import { Module } from "@nestjs/common";
import { EmailModule } from "../email/email.module";
import { PlatformModule } from "../platform/platform.module";
import { ComplianceController } from "./compliance.controller";
import { ComplianceService } from "./compliance.service";

@Module({
  imports: [PlatformModule, EmailModule],
  controllers: [ComplianceController],
  providers: [ComplianceService],
  exports: [ComplianceService]
})
export class ComplianceModule {}
