import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { PlatformModule } from "../platform/platform.module";
import { UserAiProvidersController } from "./user-ai-providers.controller";
import { UserAiProvidersService } from "./user-ai-providers.service";

@Module({
  imports: [AuditModule, PlatformModule],
  controllers: [UserAiProvidersController],
  providers: [UserAiProvidersService],
  exports: [UserAiProvidersService]
})
export class UserAiProvidersModule {}
