import { Module } from "@nestjs/common";
import { GeoapifyAdapter } from "./adapters/geoapify.adapter";
import { GeocodingChainService } from "./geocoding-chain.service";
import { GeocodingController } from "./geocoding.controller";
import { GeocodingService } from "./geocoding.service";
import { SiteResolverService } from "./site-resolver.service";

@Module({
  controllers: [GeocodingController],
  providers: [GeocodingService, SiteResolverService, GeocodingChainService, GeoapifyAdapter],
  exports: [GeocodingService, SiteResolverService, GeocodingChainService]
})
export class GeocodingModule {}
