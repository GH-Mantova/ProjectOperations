import { Module } from "@nestjs/common";
import { ArchiveController } from "./archive.controller";
import { ArchiveService } from "./archive.service";

/**
 * §16 Closeout and Archive module. Wires {@link ArchiveController} and
 * {@link ArchiveService} together and re-exports the service for any other
 * module that needs to project archive snapshots (e.g. reporting, document
 * download flows). The module owns no providers beyond the service and adds
 * no Prisma schema of its own — it is a pure read-only projection over
 * existing job/closeout/document/form-submission tables.
 */
@Module({
  controllers: [ArchiveController],
  providers: [ArchiveService],
  exports: [ArchiveService]
})
export class ArchiveModule {}
