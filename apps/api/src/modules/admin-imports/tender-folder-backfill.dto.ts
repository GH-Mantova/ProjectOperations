import { ArrayNotEmpty, IsArray, IsBoolean, IsOptional, IsString } from "class-validator";

/**
 * MIG-3.1 - Body for POST /admin/imports/tender-folders/backfill.
 *
 * tNumbers: legacy T-numbers (e.g. "T1532") whose ERP tender folders should
 *           be provisioned via SharePointService.ensureTenderFolderStructure.
 * dryRun:   when true, only resolves the legacy->canonical mapping and does
 *           NOT create any SharePoint folders. Defaults to true for safety.
 */
export class TenderFolderBackfillDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  tNumbers!: string[];

  @IsOptional()
  @IsBoolean()
  dryRun?: boolean;
}
