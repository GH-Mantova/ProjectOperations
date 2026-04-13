import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsOptional,
  IsString
} from "class-validator";

export class UpsertClientDto {
  @IsString()
  name!: string;
  @IsOptional() @IsString() code?: string;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() email?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() notes?: string;
}

export class UpsertContactDto {
  @IsString()
  clientId!: string;
  @IsString()
  firstName!: string;
  @IsString()
  lastName!: string;
  @IsOptional() @IsString() email?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() position?: string;
  @IsOptional() @IsBoolean() isPrimary?: boolean;
  @IsOptional() @IsString() notes?: string;
}

export class UpsertSiteDto {
  @IsString()
  name!: string;
  @IsOptional() @IsString() clientId?: string;
  @IsOptional() @IsString() code?: string;
  @IsOptional() @IsString() addressLine1?: string;
  @IsOptional() @IsString() suburb?: string;
  @IsOptional() @IsString() state?: string;
  @IsOptional() @IsString() postcode?: string;
  @IsOptional() @IsString() notes?: string;
}

export class UpsertResourceTypeDto {
  @IsString()
  name!: string;
  @IsString()
  category!: string;
  @IsOptional() @IsString() code?: string;
  @IsOptional() @IsString() description?: string;
}

export class UpsertCompetencyDto {
  @IsString()
  name!: string;
  @IsOptional() @IsString() code?: string;
  @IsOptional() @IsString() description?: string;
}

export class UpsertWorkerDto {
  @IsString()
  firstName!: string;
  @IsString()
  lastName!: string;
  @IsOptional() @IsString() userId?: string;
  @IsOptional() @IsString() resourceTypeId?: string;
  @IsOptional() @IsString() employeeCode?: string;
  @IsOptional() @IsString() email?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() employmentType?: string;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() notes?: string;
}

export class UpsertCrewDto {
  @IsString()
  name!: string;
  @IsOptional() @IsString() code?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsArray() workerIds?: string[];
}

export class UpsertAssetDto {
  @IsString()
  name!: string;
  @IsString()
  assetCode!: string;
  @IsOptional() @IsString() resourceTypeId?: string;
  @IsOptional() @IsString() serialNumber?: string;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() homeBase?: string;
  @IsOptional() @IsString() notes?: string;
}

export class UpsertWorkerCompetencyDto {
  @IsString()
  workerId!: string;
  @IsString()
  competencyId!: string;
  @IsOptional() @IsDateString() achievedAt?: string;
  @IsOptional() @IsDateString() expiresAt?: string;
  @IsOptional() @IsString() notes?: string;
}

export class UpsertLookupValueDto {
  @IsString()
  category!: string;
  @IsString()
  key!: string;
  @IsString()
  value!: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
