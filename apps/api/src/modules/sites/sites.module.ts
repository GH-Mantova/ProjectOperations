import { Module } from "@nestjs/common";
import { PrismaModule } from "../../prisma/prisma.module";
import { SitesController } from "./sites.controller";
import { SitesService } from "./sites.service";

// Site sign-in / sign-out — the WHS spine. The muster/evacuation view will
// import SitesService to answer "who is on site right now" without reaching
// into another module's Prisma.
@Module({
  imports: [PrismaModule],
  controllers: [SitesController],
  providers: [SitesService],
  exports: [SitesService]
})
export class SitesModule {}
