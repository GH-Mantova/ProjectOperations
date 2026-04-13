import { Global, Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";

@Global()
@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>("JWT_ACCESS_SECRET", "replace-me-access")
      })
    })
  ],
  providers: [JwtAuthGuard, PermissionsGuard],
  exports: [JwtModule, JwtAuthGuard, PermissionsGuard]
})
export class SecurityModule {}
