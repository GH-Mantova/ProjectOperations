import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { appConfig } from "./app.config";
import { authConfig } from "./auth.config";
import { portalConfig } from "./portal.config";
import { xeroConfig } from "./xero.config";
import { fuelPriceConfig } from "./fuel-price.config";

@Module({
  imports: [
    ConfigModule.forFeature(appConfig),
    ConfigModule.forFeature(authConfig),
    ConfigModule.forFeature(portalConfig),
    ConfigModule.forFeature(xeroConfig),
    ConfigModule.forFeature(fuelPriceConfig)
  ]
})
export class AppConfigModule {}
