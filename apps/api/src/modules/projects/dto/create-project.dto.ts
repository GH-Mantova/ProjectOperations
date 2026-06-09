import { Type } from "class-transformer";
import {
  IsDateString,
  IsNumberString,
  IsOptional,
  IsString
} from "class-validator";

/**
 * Request body for `POST /projects` — manual project creation (no source
 * tender). The project number is allocated server-side under a row lock;
 * the four team-role ids are optional and default to `null`. Used only
 * by callers with `projects.admin`.
 */
export class CreateProjectDto {
  /** Human-readable project name (e.g. "Crestwood Civils — Stage 2"). */
  @IsString()
  name!: string;

  /** FK to the `Client` row that this project bills to. */
  @IsString()
  clientId!: string;

  /** Street line 1 of the site address. Required (no fallback to client address). */
  @IsString()
  siteAddressLine1!: string;

  /** Optional second street line. */
  @IsOptional() @IsString()
  siteAddressLine2?: string;

  /** Suburb component of the site address. */
  @IsString()
  siteAddressSuburb!: string;

  /** Australian state code (`QLD`, `NSW`, etc.). */
  @IsString()
  siteAddressState!: string;

  /** Four-digit Australian postcode. */
  @IsString()
  siteAddressPostcode!: string;

  /** Contract value as a decimal string. Defaults to `"0"` when omitted. */
  @IsOptional() @IsNumberString()
  contractValue?: string;

  /** Budget as a decimal string. Defaults to `"0"` when omitted. */
  @IsOptional() @IsNumberString()
  budget?: string;

  /** ISO date string for the proposed start. */
  @IsOptional() @IsDateString()
  proposedStartDate?: string;

  /** FK to the User assigned as Project Manager. Triggers a notification on create. */
  @IsOptional() @IsString()
  projectManagerId?: string;

  /** FK to the User assigned as Site Supervisor. */
  @IsOptional() @IsString()
  supervisorId?: string;

  /** FK to the User assigned as Estimator (typically only set when converted from tender). */
  @IsOptional() @IsString()
  estimatorId?: string;

  /** FK to the User assigned as WHS Officer. */
  @IsOptional() @IsString()
  whsOfficerId?: string;
}
