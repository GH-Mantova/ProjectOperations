import { Module } from "@nestjs/common";
import { BrandingController, BrandingViewerController } from "./branding.controller";
import { BrandingService } from "./branding.service";

/**
 * Branding manager — BrandColorScheme + BrandAsset admin surface. Sits
 * alongside CompanyProfileModule and reuses the same @Global AuditModule /
 * PrismaModule wiring. Guards are the same super-user pattern.
 *
 * BrandingViewerController adds a single unprivileged GET /branding/active
 * endpoint so every authenticated user can read the active brand colours
 * without holding platform.admin.
 */
@Module({
  controllers: [BrandingController, BrandingViewerController],
  providers: [BrandingService],
  exports: [BrandingService]
})
export class BrandingModule {}
