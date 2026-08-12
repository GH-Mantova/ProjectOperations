import { Module } from "@nestjs/common";
import { PrismaModule } from "../../../prisma/prisma.module";
import { AccountsController } from "./accounts.controller";
import { AccountsService } from "./accounts.service";

/**
 * CRM-1: AccountsModule — Account spine + Client-360 view.
 *
 * Registered inside CrmModule (not AppModule directly) to keep the CRM
 * boundary coherent. AccountsService is exported so sibling CRM sub-modules
 * (CRM-2 relationships, CRM-3 lead intake, etc.) can depend on it.
 */
@Module({
  imports: [PrismaModule],
  controllers: [AccountsController],
  providers: [AccountsService],
  exports: [AccountsService]
})
export class AccountsModule {}
