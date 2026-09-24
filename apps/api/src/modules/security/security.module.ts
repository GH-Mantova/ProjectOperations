import { Global, Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { KeyEncryptionService } from "./key-encryption.service";
import { KeyValidationService } from "./key-validation.service";

@Global()
@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>("auth.accessSecret")
      })
    })
  ],
  providers: [JwtAuthGuard, PermissionsGuard, KeyEncryptionService, KeyValidationService],
  exports: [JwtModule, JwtAuthGuard, PermissionsGuard, KeyEncryptionService, KeyValidationService]
})
export class SecurityModule {}
