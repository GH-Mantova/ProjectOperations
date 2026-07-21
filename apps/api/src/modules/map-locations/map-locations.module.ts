import { Module } from "@nestjs/common";
import { MapLocationsController } from "./map-locations.controller";
import { MapLocationsService } from "./map-locations.service";

@Module({
  controllers: [MapLocationsController],
  providers: [MapLocationsService],
  exports: [MapLocationsService]
})
export class MapLocationsModule {}
