import { Type } from "class-transformer";
import {
  IsDateString,
  IsNumberString,
  IsOptional,
  IsString
} from "class-validator";

export class CreateProjectDto {
  @IsString()
  name!: string;

  @IsString()
  clientId!: string;

  @IsString()
  siteAddressLine1!: string;

  @IsOptional() @IsString()
  siteAddressLine2?: string;

  @IsString()
  siteAddressSuburb!: string;

  @IsString()
  siteAddressState!: string;

  @IsString()
  siteAddressPostcode!: string;

  @IsOptional() @IsNumberString()
  contractValue?: string;

  @IsOptional() @IsNumberString()
  budget?: string;

  @IsOptional() @IsDateString()
  proposedStartDate?: string;

  @IsOptional() @IsString()
  projectManagerId?: string;

  @IsOptional() @IsString()
  supervisorId?: string;

  @IsOptional() @IsString()
  estimatorId?: string;

  @IsOptional() @IsString()
  whsOfficerId?: string;
}
