import { IsOptional, IsString } from "class-validator";

export class CreateTenderDocumentDto {
  @IsString()
  category!: string;

  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  fileName!: string;

  @IsOptional()
  @IsString()
  mimeType?: string;
}
