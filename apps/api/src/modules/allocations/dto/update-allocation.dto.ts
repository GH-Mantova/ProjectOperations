import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsDateString, IsOptional, IsString, MaxLength } from "class-validator";

export class UpdateAllocationDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) roleOnProject?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() startDate?: string;
  @ApiPropertyOptional({ description: "Pass null via omission to leave unchanged; pass value to set." })
  @IsOptional()
  @IsDateString()
  endDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) notes?: string;
}
