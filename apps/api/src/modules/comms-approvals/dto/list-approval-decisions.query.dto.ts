import { IsString, MaxLength } from "class-validator";

export class ListApprovalDecisionsQueryDto {
  @IsString()
  @MaxLength(80)
  entityType!: string;

  @IsString()
  @MaxLength(120)
  entityId!: string;
}
