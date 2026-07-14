import { Module } from "@nestjs/common";
import { CompanyProfileController } from "./company-profile.controller";
import { CompanyProfileService } from "./company-profile.service";

/**
 * CompanyProfile — the singleton identifying who "we" are. Referenced by
 * document builders (PDF, Excel, ICS), email defaults, and the AI persona
 * prefix. AuditService is picked up from the @Global AuditModule.
 */
@Module({
  controllers: [CompanyProfileController],
  providers: [CompanyProfileService],
  exports: [CompanyProfileService]
})
export class CompanyProfileModule {}
