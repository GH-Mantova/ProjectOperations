import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { AuditModule } from "../audit/audit.module";
import { PasswordService } from "../../common/security/password.service";
import { PortalAuthController } from "./portal-auth.controller";
import { PortalAuthService } from "./portal-auth.service";
import { PortalClientController } from "./portal-client.controller";
import { PortalClientService } from "./portal-client.service";
import { PortalJwtGuard } from "./portal-jwt.guard";

@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>(
          "auth.portalAccessSecret",
          configService.get<string>("auth.accessSecret", "replace-me-access")
        )
      })
    }),
    AuditModule
  ],
  controllers: [PortalAuthController, PortalClientController],
  providers: [PortalAuthService, PortalClientService, PortalJwtGuard, PasswordService],
  exports: [PortalAuthService]
})
export class PortalModule {}
