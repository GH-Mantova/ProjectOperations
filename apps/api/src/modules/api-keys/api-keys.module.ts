import { Global, Module } from "@nestjs/common";
import { ApiKeysService } from "./api-keys.service";

// Global so every consumer can inject ApiKeysService without repeating module
// wiring in each feature module (mirrors IntegrationKeysModule, which was
// itself made global for the same reason).
@Global()
@Module({
  providers: [ApiKeysService],
  exports: [ApiKeysService]
})
export class ApiKeysModule {}
