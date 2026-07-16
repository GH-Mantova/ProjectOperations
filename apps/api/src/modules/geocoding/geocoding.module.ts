import { Module } from "@nestjs/common";
import { GeocodingController } from "./geocoding.controller";
import { GeocodingService } from "./geocoding.service";
import { SiteResolverService } from "./site-resolver.service";

@Module({
  controllers: [GeocodingController],
  providers: [GeocodingService, SiteResolverService],
  exports: [GeocodingService, SiteResolverService]
})
export class GeocodingModule {}
