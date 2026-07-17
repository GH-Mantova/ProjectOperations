import { Module } from "@nestjs/common";
import { SurveysController } from "./surveys.controller";
import { SurveysService } from "./surveys.service";

/**
 * Customer Voice — internal satisfaction surveys.
 * Survey templates + SurveyResponse capture + Client.preferenceScore rollup.
 * Endpoints: POST /surveys, GET /surveys, POST /surveys/:id/responses,
 *            GET /clients/:clientId/satisfaction.
 */
@Module({
  controllers: [SurveysController],
  providers: [SurveysService],
  exports: [SurveysService]
})
export class SurveysModule {}
