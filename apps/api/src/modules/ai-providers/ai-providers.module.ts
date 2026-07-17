import { Module } from "@nestjs/common";
import { PlatformModule } from "../platform/platform.module";
import { AiProvidersService } from "./ai-providers.service";
import { AssistController } from "./assist.controller";

@Module({
  imports: [PlatformModule],
  controllers: [AssistController],
  providers: [AiProvidersService],
  exports: [AiProvidersService]
})
export class AiProvidersModule {}
