import { ApiProperty } from "@nestjs/swagger";

/**
 * Response returned by `POST /forms/templates/build-from-pdf` — the
 * caller navigates to `/forms/designer/:id` to review and publish the
 * generated draft. Templates are always created in DRAFT status;
 * publishing is a separate, human-driven step.
 */
export class BuildFormFromPdfResponseDto {
  @ApiProperty({ description: "Id of the newly created DRAFT FormTemplate." })
  id!: string;

  @ApiProperty({ description: "Human-readable name derived from the PDF." })
  name!: string;

  @ApiProperty({
    description:
      "AI provider that produced the draft (audit hint only — the caller should not branch on this)."
  })
  provider!: string;

  @ApiProperty({ description: "Number of fields the AI proposed across all sections." })
  fieldCount!: number;

  @ApiProperty({ description: "Number of sections the AI proposed." })
  sectionCount!: number;
}
