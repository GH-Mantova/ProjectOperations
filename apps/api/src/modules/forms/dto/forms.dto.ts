import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  ValidateNested
} from "class-validator";
import { PaginationQueryDto } from "../../../common/dto/pagination-query.dto";

export class FormsQueryDto extends PaginationQueryDto {
  @IsOptional() @IsString() q?: string;
  @IsOptional() @IsString() status?: string;
}

export class FormFieldInputDto {
  @IsString() fieldKey!: string;
  @IsString() label!: string;
  @IsString() fieldType!: string;
  @Type(() => Number) @IsInt() fieldOrder!: number;
  @IsOptional() @IsBoolean() isRequired?: boolean;
  @IsOptional() @IsString() placeholder?: string;
  @IsOptional() @IsString() helpText?: string;
  @IsOptional() optionsJson?: unknown;
}

export class FormSectionInputDto {
  @IsString() title!: string;
  @IsOptional() @IsString() description?: string;
  @Type(() => Number) @IsInt() sectionOrder!: number;
  @IsArray() @ValidateNested({ each: true }) @Type(() => FormFieldInputDto) fields!: FormFieldInputDto[];
}

export class FormRuleInputDto {
  @IsString() sourceFieldKey!: string;
  @IsString() targetFieldKey!: string;
  @IsString() operator!: string;
  @IsOptional() @IsString() comparisonValue?: string;
  @IsOptional() @IsString() effect?: string;
}

export class UpsertFormTemplateDto {
  @IsString() name!: string;
  @IsString() code!: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsBoolean() geolocationEnabled?: boolean;
  @IsOptional() @IsArray() associationScopes?: string[];
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => FormSectionInputDto) sections!: FormSectionInputDto[];
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => FormRuleInputDto) rules?: FormRuleInputDto[];
}

export class FormSubmissionValueInputDto {
  @IsString() fieldKey!: string;
  @IsOptional() @IsString() valueText?: string;
  @IsOptional() valueNumber?: number;
  @IsOptional() @IsDateString() valueDateTime?: string;
  @IsOptional() valueJson?: unknown;
}

export class FormAttachmentInputDto {
  @IsOptional() @IsString() fieldKey?: string;
  @IsString() fileName!: string;
  @IsOptional() @IsString() fileUrl?: string;
}

export class FormSignatureInputDto {
  @IsOptional() @IsString() fieldKey?: string;
  @IsString() signerName!: string;
  @IsOptional() @IsDateString() signedAt?: string;
}

export class SubmitFormDto {
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() jobId?: string;
  @IsOptional() @IsString() clientId?: string;
  @IsOptional() @IsString() assetId?: string;
  @IsOptional() @IsString() workerId?: string;
  @IsOptional() @IsString() siteId?: string;
  @IsOptional() @IsString() shiftId?: string;
  @IsOptional() @IsString() supplierName?: string;
  @IsOptional() @IsString() geolocation?: string;
  @IsOptional() @IsString() summary?: string;
  @IsArray() @ValidateNested({ each: true }) @Type(() => FormSubmissionValueInputDto) values!: FormSubmissionValueInputDto[];
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => FormAttachmentInputDto) attachments?: FormAttachmentInputDto[];
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => FormSignatureInputDto) signatures?: FormSignatureInputDto[];
}
