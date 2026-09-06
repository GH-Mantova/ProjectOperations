import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsArray, IsNotEmpty, IsOptional } from "class-validator";

/**
 * DTO for PATCH /rates/tables/:id/charge-steps
 *
 * Accepts a step list validated server-side against the evaluator's schema.
 * Validation rules (applied in RateTablesService.patchChargeSteps):
 *  - steps[0].op must be "start"
 *  - Every step.op must be a known operation
 *  - Any field name that appears in start/multiply/divide/add/subtract or
 *    in a condition must exist on the table's columns OR among the line
 *    fields declared on it (numeric literals are allowed anywhere)
 */
export class PatchChargeStepsDto {
  @ApiProperty({ type: "array", items: { type: "object" }, description: "Ordered step list. First step must have op: start." })
  @IsArray()
  @IsNotEmpty()
  steps!: unknown[];

  /**
   * RATE_LINE_FIELDS_V1 — the values an estimator enters on the line, which a
   * step may name exactly as it names a column.
   *
   * This property has to be DECLARED, not merely tolerated: the global
   * ValidationPipe runs with `whitelist: true` and `forbidNonWhitelisted: true`
   * (`apps/api/src/bootstrap/create-app.ts`), so an undeclared property on the
   * body is a 400 rather than a quietly dropped field.
   *
   * Shape (validated in `RateTablesService`, not by class-validator, so the
   * failure messages name the offending field):
   *   { name: string; kind: "number" | "text"; unit?: string | null;
   *     options?: string[]; sample?: number | string }
   *
   * OMITTED means "leave the declared line fields alone" — the charge-steps
   * card PATCHes steps only and must not clear a declaration it cannot edit.
   * An empty array clears them.
   */
  @ApiPropertyOptional({
    type: "array",
    items: { type: "object" },
    description:
      'Line fields declared on the table: { name, kind: "number" | "text", unit?, options?, sample? }. ' +
      "Omit to leave the stored declaration unchanged; [] clears it."
  })
  @IsOptional()
  @IsArray()
  lineFields?: unknown[];
}
