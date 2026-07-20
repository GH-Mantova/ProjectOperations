import { ApiProperty } from "@nestjs/swagger";
import { IsArray, ValidateNested } from "class-validator";
import { Type } from "class-transformer";
import type { ImportOperation } from "../rates-import.service";

/**
 * The apply payload is just the `operations` array returned by /preview.
 * We validate that it's an array and let the service enforce the shape —
 * class-validator can't discriminate the union cleanly here and the
 * service already re-derives every write from these values.
 */
export class RatesImportApplyDto {
  @ApiProperty({ type: "array", items: { type: "object" }, description: "Operations from /rates/import/preview." })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => Object)
  operations!: ImportOperation[];
}
