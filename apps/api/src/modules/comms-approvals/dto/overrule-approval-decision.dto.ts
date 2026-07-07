import { IsString, MaxLength, MinLength } from "class-validator";

/**
 * Payload for overruling a prior approval decision. A reason is mandatory —
 * overrules are visible to the whole reporting chain and treated as an
 * immutable audit event. The overruler must be senior to the prior decider
 * in the `managerId` chain; ApprovalsService enforces that.
 */
export class OverruleApprovalDecisionDto {
  @IsString()
  @MinLength(3)
  @MaxLength(1000)
  reason!: string;
}
