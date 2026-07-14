import { ArrayNotEmpty, IsArray, IsString } from "class-validator";

export class ApproveAccessRequestDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  roleIds!: string[];
}
