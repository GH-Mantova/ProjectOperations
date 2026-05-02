import { Module } from "@nestjs/common";
import { PersonasController } from "./personas.controller";
import { PersonasService } from "./personas.service";
import { PersonaPermissionGuard } from "./persona-permission.guard";

@Module({
  controllers: [PersonasController],
  providers: [PersonasService, PersonaPermissionGuard],
  exports: [PersonasService]
})
export class PersonasModule {}
