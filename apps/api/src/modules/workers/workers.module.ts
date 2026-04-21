import { Module } from "@nestjs/common";
import { PasswordService } from "../../common/security/password.service";
import { WorkersController } from "./workers.controller";
import { WorkersService } from "./workers.service";

@Module({
  controllers: [WorkersController],
  providers: [WorkersService, PasswordService],
  exports: [WorkersService]
})
export class WorkersModule {}
