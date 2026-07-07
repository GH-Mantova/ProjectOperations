import { Type } from "class-transformer";
import {
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min
} from "class-validator";

/**
 * Payload for recording an approval decision on a record. `action` is the
 * authority-seam key (e.g. `procurement.purchase.approve`) used to look up
 * the caller's spend/authority limit; `amount` is compared to that limit
 * when the seam matches a bounded rule. `decision` is APPROVED or REJECTED
 * — OVERRULED is written only via the overrule endpoint.
 */
export class RecordApprovalDecisionDto {
  @IsString()
  @MaxLength(80)
  entityType!: string;

  @IsString()
  @MaxLength(120)
  entityId!: string;

  @IsString()
  @MaxLength(120)
  action!: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  amount?: number;

  @IsIn(["APPROVED", "REJECTED"])
  decision!: "APPROVED" | "REJECTED";

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;
}
