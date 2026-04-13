import { IsOptional, IsString } from "class-validator";

export class CreateNotificationDto {
  @IsString()
  userId!: string;

  @IsString()
  title!: string;

  @IsString()
  body!: string;

  @IsString()
  severity!: string;

  @IsOptional()
  @IsString()
  linkUrl?: string;
}
