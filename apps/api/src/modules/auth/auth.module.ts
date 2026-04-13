import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { AuditModule } from "../audit/audit.module";
import { PermissionsModule } from "../permissions/permissions.module";
import { PasswordService } from "../../common/security/password.service";
import { UsersModule } from "../users/users.module";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";

@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>("JWT_ACCESS_SECRET", "replace-me-access")
      })
    }),
    UsersModule,
    AuditModule,
    PermissionsModule
  ],
  controllers: [AuthController],
  providers: [AuthService, PasswordService],
  exports: [AuthService]
})
export class AuthModule {}
