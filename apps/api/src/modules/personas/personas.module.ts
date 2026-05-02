import { Module } from "@nestjs/common";
import { AiProvidersModule } from "../ai-providers/ai-providers.module";
import { PersonasController } from "./personas.controller";
import { PersonasService } from "./personas.service";
import { PersonaPermissionGuard } from "./persona-permission.guard";

@Module({
  imports: [AiProvidersModule],
  controllers: [PersonasController],
  providers: [PersonasService, PersonaPermissionGuard],
  exports: [PersonasService]
})
export class PersonasModule {}
