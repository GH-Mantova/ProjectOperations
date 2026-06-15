import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { CorrespondenceController } from "./correspondence.controller";
import { CorrespondenceService } from "./correspondence.service";
import { MockCorrespondenceAdapter } from "./adapters/mock-correspondence.adapter";
import { LiveCorrespondenceAdapter } from "./adapters/live-correspondence.adapter";
import { CORRESPONDENCE_ADAPTER, type CorrespondenceAdapter } from "./correspondence-adapter.interface";

@Module({
  controllers: [CorrespondenceController],
  providers: [
    CorrespondenceService,
    MockCorrespondenceAdapter,
    LiveCorrespondenceAdapter,
    {
      provide: CORRESPONDENCE_ADAPTER,
      inject: [ConfigService, MockCorrespondenceAdapter, LiveCorrespondenceAdapter],
      useFactory: (
        config: ConfigService,
        mock: MockCorrespondenceAdapter,
        live: LiveCorrespondenceAdapter
      ): CorrespondenceAdapter => {
        const mode = config.get<string>("CORRESPONDENCE_MODE", "mock");
        return mode === "live" ? live : mock;
      }
    }
  ],
  exports: [CorrespondenceService]
})
export class CorrespondenceModule {}
