import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaModule } from "../../prisma/prisma.module";
import { CALENDAR_ADAPTER } from "./calendar.adapter";
import { CalendarController } from "./calendar.controller";
import { CalendarService } from "./calendar.service";
import { GraphCalendarAdapter } from "./graph-calendar.adapter";
import { MockCalendarAdapter } from "./mock-calendar.adapter";

@Module({
  imports: [PrismaModule],
  controllers: [CalendarController],
  providers: [
    MockCalendarAdapter,
    GraphCalendarAdapter,
    {
      provide: CALENDAR_ADAPTER,
      inject: [ConfigService, MockCalendarAdapter, GraphCalendarAdapter],
      useFactory: (
        config: ConfigService,
        mock: MockCalendarAdapter,
        live: GraphCalendarAdapter
      ) => {
        const mode = config.get<string>("CALENDAR_MODE", "mock");
        return mode === "live" ? live : mock;
      }
    },
    CalendarService
  ],
  exports: [CalendarService]
})
export class CalendarModule {}
