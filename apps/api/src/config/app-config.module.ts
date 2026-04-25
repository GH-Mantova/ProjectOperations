import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { appConfig } from "./app.config";
import { authConfig } from "./auth.config";
import { portalConfig } from "./portal.config";
import { xeroConfig } from "./xero.config";

@Module({
  imports: [
    ConfigModule.forFeature(appConfig),
    ConfigModule.forFeature(authConfig),
    ConfigModule.forFeature(portalConfig),
    ConfigModule.forFeature(xeroConfig)
  ]
})
export class AppConfigModule {}
