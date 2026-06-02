import { Module } from "@nestjs/common";
import { DirectoryController } from "./directory.controller";
import { DirectoryService } from "./directory.service";

/**
 * NestJS module that wires up the directory REST surface
 * ({@link DirectoryController}) covering subcontractors and suppliers, plus
 * their nested contacts, licences, insurances, credit applications, and
 * documents. {@link DirectoryService} is re-exported so other modules
 * (e.g. tendering, jobs) can read/write directory records without going
 * through HTTP.
 */
@Module({
  controllers: [DirectoryController],
  providers: [DirectoryService],
  exports: [DirectoryService]
})
export class DirectoryModule {}
