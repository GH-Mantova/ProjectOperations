import { ApiProperty } from "@nestjs/swagger";
import { IsString, MaxLength } from "class-validator";

export class UpdateCompanyInstructionDto {
  @ApiProperty({
    description: "Company-wide instruction prepended to the persona's system prompt. Markdown allowed. Empty string is allowed.",
    maxLength: 20000
  })
  @IsString()
  @MaxLength(20000)
  instruction!: string;
}
