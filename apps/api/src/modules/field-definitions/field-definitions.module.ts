import { Module } from "@nestjs/common";
import { FieldDefinitionsService } from "./field-definitions.service";

@Module({
  providers: [FieldDefinitionsService],
  exports: [FieldDefinitionsService]
})
export class FieldDefinitionsModule {}
