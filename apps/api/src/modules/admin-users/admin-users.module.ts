import { Module } from "@nestjs/common";
import { PasswordService } from "../../common/security/password.service";
import { AdminUsersController } from "./admin-users.controller";
import { AdminUsersService } from "./admin-users.service";

@Module({
  controllers: [AdminUsersController],
  providers: [AdminUsersService, PasswordService],
  exports: [AdminUsersService]
})
export class AdminUsersModule {}
