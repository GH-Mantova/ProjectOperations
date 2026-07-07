import { Module } from "@nestjs/common";
import { RatesController } from "./rates.controller";
import { RateTablesService } from "./rate-tables.service";
import { RateResolverService } from "./rate-resolver.service";
import { RateValidationService } from "./rate-validation.service";

@Module({
  controllers: [RatesController],
  providers: [RateTablesService, RateResolverService, RateValidationService],
  exports: [RateTablesService, RateResolverService, RateValidationService]
})
export class RatesModule {}
