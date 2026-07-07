import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export enum ListBindingConsumerTypeDto {
  RATE_COLUMN = "RATE_COLUMN",
  FORM_FIELD = "FORM_FIELD",
  MODULE_DROPDOWN = "MODULE_DROPDOWN"
}

export class CreateListBindingDto {
  @ApiProperty() @IsString() @MinLength(1) listId!: string;

  @ApiProperty({ enum: ListBindingConsumerTypeDto })
  @IsEnum(ListBindingConsumerTypeDto)
  consumerType!: ListBindingConsumerTypeDto;

  @ApiProperty() @IsString() @MinLength(1) @MaxLength(200) consumerRef!: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) label?: string;
}

export class UpdateListBindingDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) label?: string;
}
