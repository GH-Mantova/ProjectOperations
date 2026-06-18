import { Type } from "class-transformer";
import { IsDateString, IsInt, IsOptional, IsString } from "class-validator";
import { PaginationQueryDto } from "../../../common/dto/pagination-query.dto";

/**
 * Query parameters for listing workers in the resources module.
 *
 * Extends pagination (page/pageSize) with optional free-text and
 * competency filters consumed by {@link ResourcesService.listWorkers}.
 */
export class ResourcesQueryDto extends PaginationQueryDto {
  /** Free-text search applied case-insensitively to firstName, lastName, and employeeCode. */
  @IsOptional() @IsString() q?: string;
  /** Restrict to workers holding the given competency. */
  @IsOptional() @IsString() competencyId?: string;
}

/**
 * Payload for creating or updating a worker availability window.
 *
 * Used by both POST and PATCH on `/resources/availability-windows`.
 * Status defaults to `AVAILABLE` when omitted by the service.
 */
export class UpsertAvailabilityWindowDto {
  /** Worker the availability window belongs to. */
  @IsString() workerId!: string;
  /** Window start as an ISO-8601 date-time string. */
  @IsDateString() startAt!: string;
  /** Window end as an ISO-8601 date-time string. */
  @IsDateString() endAt!: string;
  /** Availability status (e.g. AVAILABLE, UNAVAILABLE, LEAVE); defaults to AVAILABLE. */
  @IsOptional() @IsString() status?: string;
  /** Free-text notes captured against the window. */
  @IsOptional() @IsString() notes?: string;
}

/**
 * Payload for creating or updating a worker's suitability for a role
 * (e.g. "Crew Lead", "Excavator Operator").
 *
 * Creation rejects duplicates per worker + roleLabel; updates skip that
 * check. Suitability defaults to `SUITABLE` when omitted.
 */
export class UpsertWorkerRoleSuitabilityDto {
  /** Worker whose role suitability is being recorded. */
  @IsString() workerId!: string;
  /** Human-readable role label this suitability applies to. */
  @IsString() roleLabel!: string;
  /** Suitability rating (e.g. SUITABLE, PREFERRED, RESTRICTED); defaults to SUITABLE. */
  @IsOptional() @IsString() suitability?: string;
  /** Free-text notes captured against the suitability record. */
  @IsOptional() @IsString() notes?: string;
}

/**
 * Payload for creating or updating a shift role requirement.
 *
 * The owning `shiftId` is taken from the route, not the body.
 * `requiredCount` defaults to 1 when omitted.
 */
export class UpsertShiftRoleRequirementDto {
  /** Human-readable role label this requirement is for (e.g. "Foreman"). */
  @IsString() roleLabel!: string;
  /** Optional competency that workers filling this role must hold. */
  @IsOptional() @IsString() competencyId?: string;
  /** Number of workers required in this role for the shift; defaults to 1. */
  @IsOptional() @Type(() => Number) @IsInt() requiredCount?: number;
}
