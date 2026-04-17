import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { AuditModule } from "../audit/audit.module";
import { PasswordService } from "../../common/security/password.service";
import { UsersModule } from "../users/users.module";
import { AuthProviderService } from "./auth-provider.service";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { EntraAuthService } from "./entra-auth.service";
import { EntraTokenValidatorService } from "./entra-token-validator.service";
import { LocalAuthProvider } from "./local-auth.provider";

@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>("auth.accessSecret", "replace-me-access")
      })
    }),
    UsersModule,
    AuditModule
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    PasswordService,
    LocalAuthProvider,
    AuthProviderService,
    EntraTokenValidatorService,
    EntraAuthService
  ],
  exports: [AuthService]
})
export class AuthModule {}
