import { Module } from "@nestjs/common";
import { ContactsController } from "./contacts.controller";
import { ContactsService } from "./contacts.service";

/**
 * NestJS module that wires up the cross-organisation Contact REST surface
 * ({@link ContactsController}) — a polymorphic CRUD over the shared Contact
 * table covering CLIENT, SUBCONTRACTOR, and SUPPLIER organisations.
 * {@link ContactsService} is re-exported so other modules can reuse the
 * contact lookup and primary-contact invariants without going through HTTP.
 */
@Module({
  controllers: [ContactsController],
  providers: [ContactsService],
  exports: [ContactsService]
})
export class ContactsModule {}
