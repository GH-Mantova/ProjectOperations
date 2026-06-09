import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsOptional, IsString } from "class-validator";
import {
  DOCUMENT_CATEGORIES,
  DocumentCategory
} from "../tender-document-categories";

export class CreateTenderDocumentDto {
  // PR-64 — constrained to the canonical 11-category list. The frontend
  // shows these as a dropdown; any other caller is held to the same set
  // so uploads always have a real subfolder to route to.
  @ApiProperty({
    description: "Document category (used to route the upload into the matching SharePoint subfolder).",
    enum: DOCUMENT_CATEGORIES as readonly string[]
  })
  @IsString()
  @IsIn(DOCUMENT_CATEGORIES as readonly string[], {
    message: `category must be one of: ${DOCUMENT_CATEGORIES.join(", ")}`
  })
  category!: DocumentCategory;

  @ApiProperty()
  @IsString()
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty()
  @IsString()
  fileName!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  mimeType?: string;
}
