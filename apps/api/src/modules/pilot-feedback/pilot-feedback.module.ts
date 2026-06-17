import { Module } from "@nestjs/common";
import { PilotFeedbackController } from "./pilot-feedback.controller";
import { PilotFeedbackService } from "./pilot-feedback.service";

@Module({
  controllers: [PilotFeedbackController],
  providers: [PilotFeedbackService],
  exports: [PilotFeedbackService]
})
export class PilotFeedbackModule {}
