import { Module } from "@nestjs/common";
import { BrandingController } from "./branding.controller";
import { BrandingService } from "./branding.service";

/**
 * Branding manager — BrandColorScheme + BrandAsset admin surface. Sits
 * alongside CompanyProfileModule and reuses the same @Global AuditModule /
 * PrismaModule wiring. Guards are the same super-user pattern.
 */
@Module({
  controllers: [BrandingController],
  providers: [BrandingService],
  exports: [BrandingService]
})
export class BrandingModule {}
