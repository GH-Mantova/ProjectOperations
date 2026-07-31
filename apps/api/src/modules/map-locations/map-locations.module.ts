import { Module } from "@nestjs/common";
import { MapLocationsController } from "./map-locations.controller";
import { MapLocationsService } from "./map-locations.service";
import { TipRecommendationsController } from "./tip-recommendations.controller";
import { TipRecommendationsService } from "./tip-recommendations.service";
import { RatesModule } from "../rates/rates.module";

@Module({
  imports: [RatesModule],
  controllers: [MapLocationsController, TipRecommendationsController],
  providers: [MapLocationsService, TipRecommendationsService],
  exports: [MapLocationsService, TipRecommendationsService]
})
export class MapLocationsModule {}
