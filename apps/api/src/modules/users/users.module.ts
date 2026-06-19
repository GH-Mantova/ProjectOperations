import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { PasswordService } from "../../common/security/password.service";
import { UsersController } from "./users.controller";
import { UsersService } from "./users.service";

/**
 * Application-user administration module — login accounts (UsersService),
 * distinct from the field-personnel records managed by WorkersService.
 *
 * Wires the HTTP controller and exports `UsersService` so AuthModule and
 * other consumers can resolve user records (including the password hash
 * via `findByEmailWithSecurity`) for authentication flows.
 */
@Module({
  imports: [AuditModule],
  controllers: [UsersController],
  providers: [UsersService, PasswordService],
  exports: [UsersService]
})
export class UsersModule {}
