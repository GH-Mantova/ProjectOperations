import { ApiProperty } from "@nestjs/swagger";
import { IsString, IsUrl } from "class-validator";

export class XeroCallbackDto {
  @ApiProperty()
  @IsUrl({ require_tld: false })
  callbackUrl!: string;
}

export class XeroSyncContactDto {
  @ApiProperty()
  @IsString()
  clientId!: string;
}

export class XeroCreateInvoiceDto {
  @ApiProperty()
  @IsString()
  progressClaimId!: string;
}
