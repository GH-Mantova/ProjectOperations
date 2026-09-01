import { ApiProperty } from "@nestjs/swagger";
import { IsArray, IsNotEmpty } from "class-validator";

/**
 * DTO for PATCH /rates/tables/:id/charge-steps
 *
 * Accepts a step list validated server-side against the evaluator's schema.
 * Validation rules (applied in RateTablesService.patchChargeSteps):
 *  - steps[0].op must be "start"
 *  - Every step.op must be a known operation
 *  - Any field name that appears in start/multiply/divide/add/subtract or
 *    in a condition must exist on the table's columns (numeric literals
 *    are allowed anywhere)
 */
export class PatchChargeStepsDto {
  @ApiProperty({ type: "array", items: { type: "object" }, description: "Ordered step list. First step must have op: start." })
  @IsArray()
  @IsNotEmpty()
  steps!: unknown[];
}
