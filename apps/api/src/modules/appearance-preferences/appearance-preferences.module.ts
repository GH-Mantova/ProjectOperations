import { Module } from "@nestjs/common";
import { AppearancePreferencesController } from "./appearance-preferences.controller";
import { AppearancePreferencesService } from "./appearance-preferences.service";

@Module({
  controllers: [AppearancePreferencesController],
  providers: [AppearancePreferencesService],
  exports: [AppearancePreferencesService]
})
export class AppearancePreferencesModule {}
