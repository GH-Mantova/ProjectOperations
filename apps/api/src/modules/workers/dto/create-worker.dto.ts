import { IsBoolean, IsEmail, IsOptional, IsString, MaxLength, MinLength } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class CreateWorkerDto {
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(100) firstName!: string;
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(100) lastName!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) preferredName?: string;
  @ApiProperty({ description: "Position / trade / role (e.g. 'Operator', 'Foreman')." })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  role!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(40) phone?: string;
  @ApiPropertyOptional() @IsOptional() @IsEmail() email?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) emergencyContactName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(40) emergencyContactPhone?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(60) licenceNumber?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(60) licenceClass?: string;
  @ApiPropertyOptional({ description: "Comma-separated ticket list; full compliance tracking comes later." })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  ticketNumbers?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() hasMobileAccess?: boolean;
}
