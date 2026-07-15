import { Global, Module } from "@nestjs/common";
import { IntegrationKeysService } from "./integration-keys.service";

@Global()
@Module({
  providers: [IntegrationKeysService],
  exports: [IntegrationKeysService]
})
export class IntegrationKeysModule {}
