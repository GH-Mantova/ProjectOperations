import { IsString, MaxLength, MinLength } from "class-validator";
import { SharePointMappingEntityType } from "@prisma/client";

export const ENTITY_TYPES: SharePointMappingEntityType[] = ["TENDER", "JOB"];

export class UpdateSharePointFolderMappingDto {
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  folderPath!: string;
}

// Runtime guard for `:entityType` path params. Throws so the caller
// (controller) converts to BadRequest — never falls through to a
// query with a bogus string value.
export function assertEntityType(value: string): SharePointMappingEntityType {
  if ((ENTITY_TYPES as string[]).includes(value)) {
    return value as SharePointMappingEntityType;
  }
  throw new Error(`Unknown entity type: ${value}. Must be one of: ${ENTITY_TYPES.join(", ")}.`);
}
