import { Module } from "@nestjs/common";
import { PlatformModule } from "../platform/platform.module";
import { AiProvidersService } from "./ai-providers.service";

@Module({
  imports: [PlatformModule],
  providers: [AiProvidersService],
  exports: [AiProvidersService]
})
export class AiProvidersModule {}
