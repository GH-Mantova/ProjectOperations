import { Global, Module } from "@nestjs/common";
import { ApiKeysController } from "./api-keys.controller";
import { ApiKeysService } from "./api-keys.service";
import {
  ApiKeyMutationEvents,
  GeocodingAdapterRegistry
} from "./api-key-mutation-events";

// Global so every consumer can inject ApiKeysService without repeating module
// wiring in each feature module (mirrors IntegrationKeysModule, which was
// itself made global for the same reason). ApiKeyMutationEvents and the
// GeocodingAdapterRegistry are also exported globally so GeocodingModule can
// subscribe / register without creating a hard module dependency back into
// ApiKeysModule (avoids a cycle — GeocodingModule already depends on
// ApiKeysService, so an import in the reverse direction would loop).
@Global()
@Module({
  controllers: [ApiKeysController],
  providers: [ApiKeysService, ApiKeyMutationEvents, GeocodingAdapterRegistry],
  exports: [ApiKeysService, ApiKeyMutationEvents, GeocodingAdapterRegistry]
})
export class ApiKeysModule {}
