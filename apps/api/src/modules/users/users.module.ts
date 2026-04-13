import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { PasswordService } from "../../common/security/password.service";
import { UsersController } from "./users.controller";
import { UsersService } from "./users.service";

@Module({
  imports: [AuditModule],
  controllers: [UsersController],
  providers: [UsersService, PasswordService],
  exports: [UsersService]
})
export class UsersModule {}
