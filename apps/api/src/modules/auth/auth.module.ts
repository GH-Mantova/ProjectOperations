import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { ThrottlerModule } from "@nestjs/throttler";
import { AuditModule } from "../audit/audit.module";
import {
  AUTH_THROTTLE_ERROR_MESSAGE,
  authThrottleLoginLimit,
  authThrottleTracker,
  authThrottleTtlMs
} from "./auth-throttle.config";
import { PasswordService } from "../../common/security/password.service";
import { UsersModule } from "../users/users.module";
import { AuthProviderService } from "./auth-provider.service";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { EntraAuthService } from "./entra-auth.service";
import { EntraTokenValidatorService } from "./entra-token-validator.service";
import { LocalAuthProvider } from "./local-auth.provider";
import { OtpAuthProvider } from "./otp-auth.provider";
import { LoggingOtpDelivery, OTP_DELIVERY_PORT } from "./otp-delivery.port";

@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>("auth.accessSecret", "replace-me-access")
      })
    }),
    ThrottlerModule.forRoot({
      throttlers: [{ ttl: authThrottleTtlMs, limit: authThrottleLoginLimit }],
      errorMessage: AUTH_THROTTLE_ERROR_MESSAGE,
      getTracker: (req) => authThrottleTracker(req)
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
    EntraAuthService,
    OtpAuthProvider,
    // Dev/CI delivery: logs the code. Production email delivery (Graph
    // / SMTP) is a separate, Marco-supervised adapter registered later.
    { provide: OTP_DELIVERY_PORT, useClass: LoggingOtpDelivery }
  ],
  exports: [AuthService, EntraAuthService, EntraTokenValidatorService]
})
export class AuthModule {}
