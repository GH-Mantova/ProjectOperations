import { Module } from "@nestjs/common";
import { CustomRestAdapter } from "./adapters/custom-rest.adapter";
import { GeoapifyAdapter } from "./adapters/geoapify.adapter";
import { GeocodifyAdapter } from "./adapters/geocodify.adapter";
import { GoogleAdapter } from "./adapters/google.adapter";
import { MapTilerAdapter } from "./adapters/maptiler.adapter";
import { NominatimAdapter } from "./adapters/nominatim.adapter";
import { GeocodingChainService } from "./geocoding-chain.service";
import { GeocodingController } from "./geocoding.controller";
import { GeocodingService } from "./geocoding.service";
import { SiteResolverService } from "./site-resolver.service";

@Module({
  controllers: [GeocodingController],
  providers: [
    GeocodingService,
    SiteResolverService,
    GeocodingChainService,
    GeoapifyAdapter,
    GoogleAdapter,
    GeocodifyAdapter,
    MapTilerAdapter,
    NominatimAdapter,
    CustomRestAdapter
  ],
  exports: [GeocodingService, SiteResolverService, GeocodingChainService]
})
export class GeocodingModule {}
