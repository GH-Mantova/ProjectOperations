import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { appConfig } from "./app.config";
import { authConfig } from "./auth.config";

@Module({
  imports: [
    ConfigModule.forFeature(appConfig),
    ConfigModule.forFeature(authConfig)
  ]
})
export class AppConfigModule {}
