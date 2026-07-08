import { Module } from "@nestjs/common";
import { APP_INTERCEPTOR } from "@nestjs/core";
import { AdminClientVersionsController } from "./admin-client-versions.controller";
import { ClientVersionInterceptor } from "./client-versions.interceptor";
import { ClientVersionsService } from "./client-versions.service";

@Module({
  controllers: [AdminClientVersionsController],
  providers: [
    ClientVersionsService,
    { provide: APP_INTERCEPTOR, useClass: ClientVersionInterceptor }
  ],
  exports: [ClientVersionsService]
})
export class ClientVersionsModule {}
