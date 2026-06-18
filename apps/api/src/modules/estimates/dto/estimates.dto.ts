import { Type } from "class-transformer";
import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsNumberString,
  IsOptional,
  IsString,
  Min
} from "class-validator";

// ──────────────────────────────────────────────────────────────
//  Rate library DTOs
// ──────────────────────────────────────────────────────────────

/**
 * Create-or-update payload for a labour rate (rate library).
 *
 * Monetary fields are accepted as numeric strings so Prisma.Decimal can
 * parse them without floating-point loss.
 */
export class UpsertLabourRateDto {
  /** Trade/role label, e.g. "Concreter", "Cutting Operator". */
  @IsString() role!: string;
  /** Day-shift rate (currency per day). */
  @IsNumberString() dayRate!: string;
  /** Night-shift rate (currency per day). */
  @IsNumberString() nightRate!: string;
  /** Weekend rate (currency per day). */
  @IsNumberString() weekendRate!: string;
  /** Whether the row is selectable in the picker; defaults true on create. */
  @IsOptional() @IsBoolean() isActive?: boolean;
  /** Manual ordering hint (lower first). */
  @IsOptional() @Type(() => Number) @IsInt() sortOrder?: number;
}

/**
 * Create-or-update payload for a plant rate (rate library).
 * Unit defaults to "day" and fuelRate to 0 when omitted server-side.
 */
export class UpsertPlantRateDto {
  /** Plant item description, e.g. "Excavator 5T". */
  @IsString() item!: string;
  /** Rate unit (typically "day", "hr"); server defaults to "day". */
  @IsOptional() @IsString() unit?: string;
  /** Hire rate per unit. */
  @IsNumberString() rate!: string;
  /** Fuel surcharge per unit; server defaults to "0". */
  @IsOptional() @IsNumberString() fuelRate?: string;
  /** Whether the row is selectable in the picker; defaults true on create. */
  @IsOptional() @IsBoolean() isActive?: boolean;
  /** Manual ordering hint (lower first). */
  @IsOptional() @Type(() => Number) @IsInt() sortOrder?: number;
}

/**
 * Create-or-update payload for a waste rate (rate library).
 * Unit defaults to "tonne" and loadRate to 0 when omitted server-side.
 */
export class UpsertWasteRateDto {
  /** Waste stream/type, e.g. "Concrete", "Asphalt". */
  @IsString() wasteType!: string;
  /** Receiving facility/tip name. */
  @IsString() facility!: string;
  /** Optional grouping label for filter/sort. */
  @IsOptional() @IsString() wasteGroup?: string;
  /** Rate unit (typically "tonne"); server defaults to "tonne". */
  @IsOptional() @IsString() unit?: string;
  /** Per-tonne tipping rate. */
  @IsNumberString() tonRate!: string;
  /** Per-load haulage rate; server defaults to "0". */
  @IsOptional() @IsNumberString() loadRate?: string;
  /** Whether the row is selectable in the picker; defaults true on create. */
  @IsOptional() @IsBoolean() isActive?: boolean;
  /** Manual ordering hint (lower first). */
  @IsOptional() @Type(() => Number) @IsInt() sortOrder?: number;
}

/**
 * Create-or-update payload for a cutting rate, keyed by
 * equipment/elevation/material/depth.
 */
export class UpsertCuttingRateDto {
  /** Cutting equipment, e.g. "Hand Saw", "Wall Saw". */
  @IsString() equipment!: string;
  /** Elevation context, e.g. "Floor", "Wall". */
  @IsString() elevation!: string;
  /** Material being cut, e.g. "Concrete", "Asphalt". */
  @IsString() material!: string;
  /** Cut depth in millimetres. */
  @Type(() => Number) @IsInt() depthMm!: number;
  /** Rate per linear metre of cut. */
  @IsNumberString() ratePerM!: string;
  /** Whether the row is selectable in the picker; defaults true on create. */
  @IsOptional() @IsBoolean() isActive?: boolean;
  /** Manual ordering hint (lower first). */
  @IsOptional() @Type(() => Number) @IsInt() sortOrder?: number;
}

/**
 * Create-or-update payload for a core-hole rate, keyed by diameter.
 */
export class UpsertCoreHoleRateDto {
  /** Hole diameter in millimetres. */
  @Type(() => Number) @IsInt() diameterMm!: number;
  /** Flat rate per hole drilled. */
  @IsNumberString() ratePerHole!: string;
  /** Whether the row is selectable in the picker; defaults true on create. */
  @IsOptional() @IsBoolean() isActive?: boolean;
}

/**
 * Create-or-update payload for a fuel rate (diesel/ULP per unit).
 */
export class UpsertFuelRateDto {
  /** Fuel item label, e.g. "Diesel", "ULP". */
  @IsString() item!: string;
  /** Rate unit, e.g. "litre". */
  @IsString() unit!: string;
  /** Rate per unit. */
  @IsNumberString() rate!: string;
  /** Whether the row is selectable in the picker; defaults true on create. */
  @IsOptional() @IsBoolean() isActive?: boolean;
  /** Manual ordering hint (lower first). */
  @IsOptional() @Type(() => Number) @IsInt() sortOrder?: number;
}

/**
 * Create-or-update payload for an enclosure/containment rate (dust
 * shrouds, spark blankets, etc.).
 */
export class UpsertEnclosureRateDto {
  /** Enclosure type/description. */
  @IsString() enclosureType!: string;
  /** Rate unit, e.g. "m2", "ea". */
  @IsString() unit!: string;
  /** Rate per unit. */
  @IsNumberString() rate!: string;
  /** Whether the row is selectable in the picker; defaults true on create. */
  @IsOptional() @IsBoolean() isActive?: boolean;
  /** Manual ordering hint (lower first). */
  @IsOptional() @Type(() => Number) @IsInt() sortOrder?: number;
}

/**
 * Create-or-update payload for a cutting-sheet "other" rate
 * (establishment fees, blade changes, etc.).
 */
export class UpsertOtherRateDto {
  /** Free-text description of the charge. */
  @IsString() description!: string;
  /** Rate unit, e.g. "ea", "hr". */
  @IsString() unit!: string;
  /** Rate per unit. */
  @IsNumberString() rate!: string;
  /** Whether the row is selectable in the picker; defaults true on create. */
  @IsOptional() @IsBoolean() isActive?: boolean;
  /** Manual ordering hint (lower first). */
  @IsOptional() @Type(() => Number) @IsInt() sortOrder?: number;
}

/**
 * Create-or-update payload for a material density (mass-per-volume
 * lookup used to convert waste volumes to tonnes).
 */
export class UpsertMaterialDensityDto {
  /** Material name, e.g. "Concrete", "Reinforced concrete". */
  @IsString() materialName!: string;
  /** Density value, paired with `unit`. */
  @IsNumberString() density!: string;
  /** Density unit, e.g. "t/m3". */
  @IsString() unit!: string;
  /** Optional category for grouping in the picker. */
  @IsOptional() @IsString() category?: string;
  /** Optional free-text notes shown alongside the row. */
  @IsOptional() @IsString() notes?: string;
  /** Whether the row is selectable in the picker; defaults true on create. */
  @IsOptional() @IsBoolean() isActive?: boolean;
  /** Manual ordering hint (lower first). */
  @IsOptional() @Type(() => Number) @IsInt() sortOrder?: number;
}

// ──────────────────────────────────────────────────────────────
//  Estimate & scope-item DTOs
// ──────────────────────────────────────────────────────────────

/**
 * PATCH payload for the tender-level estimate (markup % and notes).
 * Used by the scope-of-works markup picker; service applies upsert
 * semantics when no estimate exists yet.
 */
export class UpdateEstimateDto {
  /** Estimate-wide markup percentage (e.g. "30" = 30%). */
  @IsOptional() @IsNumberString() markup?: string;
  /** Free-text notes attached to the estimate. */
  @IsOptional() @IsString() notes?: string;
}

/**
 * Create payload for a scope item on an estimate.
 * itemNumber defaults to (count of existing items with the same code)+1
 * server-side; markup defaults to 30%.
 */
export class UpsertEstimateItemDto {
  /** Item code, e.g. "1.1", "P1" — items group under codes. */
  @IsString() code!: string;
  /** Optional explicit item number within the code; derived when omitted. */
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) itemNumber?: number;
  /** Short item title. */
  @IsString() title!: string;
  /** Optional descriptive body for the item. */
  @IsOptional() @IsString() description?: string;
  /** Per-item markup percentage; defaults to "30" server-side. */
  @IsOptional() @IsNumberString() markup?: string;
  /** Flag as provisional sum — passes through at provisionalAmount with no markup. */
  @IsOptional() @IsBoolean() isProvisional?: boolean;
  /** Client-facing price when provisional; ignored otherwise. */
  @IsOptional() @IsNumberString() provisionalAmount?: string;
  /** Manual ordering hint (lower first). */
  @IsOptional() @Type(() => Number) @IsInt() sortOrder?: number;
}

/**
 * Sparse-update payload for a scope item; only defined fields are
 * persisted.
 */
export class UpdateEstimateItemDto {
  /** Short item title. */
  @IsOptional() @IsString() title?: string;
  /** Optional descriptive body for the item. */
  @IsOptional() @IsString() description?: string;
  /** Per-item markup percentage. */
  @IsOptional() @IsNumberString() markup?: string;
  /** Flag as provisional sum — passes through at provisionalAmount with no markup. */
  @IsOptional() @IsBoolean() isProvisional?: boolean;
  /** Client-facing price when provisional; ignored otherwise. */
  @IsOptional() @IsNumberString() provisionalAmount?: string;
  /** Manual ordering hint (lower first). */
  @IsOptional() @Type(() => Number) @IsInt() sortOrder?: number;
}

// ──────────────────────────────────────────────────────────────
//  Cost-line DTOs (create)
// ──────────────────────────────────────────────────────────────

/**
 * Create payload for a labour cost line on a scope item.
 * Line total = qty × days × rate. Shift defaults to "Day".
 */
export class UpsertLabourLineDto {
  /** Trade/role label, typically picked from the labour rate library. */
  @IsString() role!: string;
  /** Headcount. */
  @IsNumberString() qty!: string;
  /** Duration in days. */
  @IsNumberString() days!: string;
  /** Shift label ("Day"/"Night"/"Weekend"); defaults "Day". */
  @IsOptional() @IsString() shift?: string;
  /** Rate per person-day for the chosen shift. */
  @IsNumberString() rate!: string;
  /** Manual ordering hint within the item (lower first). */
  @IsOptional() @Type(() => Number) @IsInt() sortOrder?: number;
}

/**
 * Create payload for a plant cost line on a scope item.
 * Line total = qty × days × rate.
 */
export class UpsertPlantLineDto {
  /** Plant item description, typically picked from the plant rate library. */
  @IsString() plantItem!: string;
  /** Number of units on site. */
  @IsNumberString() qty!: string;
  /** Duration in days. */
  @IsNumberString() days!: string;
  /** Optional free-text comment. */
  @IsOptional() @IsString() comment?: string;
  /** Hire rate per unit-day. */
  @IsNumberString() rate!: string;
  /** Manual ordering hint within the item (lower first). */
  @IsOptional() @Type(() => Number) @IsInt() sortOrder?: number;
}

/**
 * Create payload for a waste/tipping cost line on a scope item.
 * Line total = qtyTonnes × tonRate + loads × loadRate.
 */
export class UpsertWasteLineDto {
  /** Optional grouping label, mirrored from the rate library. */
  @IsOptional() @IsString() wasteGroup?: string;
  /** Waste stream/type. */
  @IsString() wasteType!: string;
  /** Receiving facility. */
  @IsString() facility!: string;
  /** Tonnage tipped. */
  @IsNumberString() qtyTonnes!: string;
  /** Per-tonne rate. */
  @IsNumberString() tonRate!: string;
  /** Number of truck loads; defaults 0. */
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) loads?: number;
  /** Per-load haulage rate; defaults "0". */
  @IsOptional() @IsNumberString() loadRate?: string;
  /** Manual ordering hint within the item (lower first). */
  @IsOptional() @Type(() => Number) @IsInt() sortOrder?: number;
}

/**
 * Create payload for a cutting cost line on a scope item.
 * Line total = qty × rate. Most contextual fields are optional so the
 * line can represent any cutting type (saw cut, core hole, demo, etc.).
 */
export class UpsertCuttingLineDto {
  /** Cutting line type, e.g. "saw", "coreHole", "other". */
  @IsString() cuttingType!: string;
  /** Equipment used (when applicable). */
  @IsOptional() @IsString() equipment?: string;
  /** Elevation context (when applicable). */
  @IsOptional() @IsString() elevation?: string;
  /** Material cut (when applicable). */
  @IsOptional() @IsString() material?: string;
  /** Cut depth in millimetres (saw cuts). */
  @IsOptional() @Type(() => Number) @IsInt() depthMm?: number;
  /** Hole diameter in millimetres (core holes). */
  @IsOptional() @Type(() => Number) @IsInt() diameterMm?: number;
  /** Quantity in `unit`s. */
  @IsNumberString() qty!: string;
  /** Quantity unit, e.g. "m", "ea". */
  @IsString() unit!: string;
  /** Optional free-text comment. */
  @IsOptional() @IsString() comment?: string;
  /** Rate per unit. */
  @IsNumberString() rate!: string;
  /** Manual ordering hint within the item (lower first). */
  @IsOptional() @Type(() => Number) @IsInt() sortOrder?: number;
}

/**
 * Create payload for an equipment/subcontractor cost line on a scope
 * item. Line total = qty × duration × rate. Period defaults to "Day".
 */
export class UpsertEquipLineDto {
  /** Free-text description (equipment hire or subcontract scope). */
  @IsString() description!: string;
  /** Quantity of units/crews. */
  @IsNumberString() qty!: string;
  /** Duration in `period` units. */
  @IsNumberString() duration!: string;
  /** Period unit, e.g. "Day", "Week"; defaults "Day". */
  @IsOptional() @IsString() period?: string;
  /** Rate per unit-period. */
  @IsNumberString() rate!: string;
  /** Manual ordering hint within the item (lower first). */
  @IsOptional() @Type(() => Number) @IsInt() sortOrder?: number;
}

/**
 * Sparse-update payload for an equipment/subcontractor line; only
 * defined fields are persisted.
 */
export class UpdateEquipLineDto {
  /** Free-text description. */
  @IsOptional() @IsString() description?: string;
  /** Quantity of units/crews. */
  @IsOptional() @IsNumberString() qty?: string;
  /** Duration in `period` units. */
  @IsOptional() @IsNumberString() duration?: string;
  /** Period unit, e.g. "Day", "Week". */
  @IsOptional() @IsString() period?: string;
  /** Rate per unit-period. */
  @IsOptional() @IsNumberString() rate?: string;
  /** Manual ordering hint within the item (lower first). */
  @IsOptional() @Type(() => Number) @IsInt() sortOrder?: number;
}

/**
 * Create payload for a free-text assumption on a scope item.
 * Assumptions appear in the client-facing scope of works.
 */
export class UpsertAssumptionDto {
  /** The assumption text as it should appear in the SOW. */
  @IsString() text!: string;
  /** Manual ordering hint within the item (lower first). */
  @IsOptional() @Type(() => Number) @IsInt() sortOrder?: number;
}

// ──────────────────────────────────────────────────────────────
//  Cost-line DTOs (sparse update — all fields optional)
// ──────────────────────────────────────────────────────────────

/** Sparse-update payload for a labour line; only defined fields are persisted. */
export class UpdateLabourLineDto {
  /** Trade/role label. */
  @IsOptional() @IsString() role?: string;
  /** Headcount. */
  @IsOptional() @IsNumberString() qty?: string;
  /** Duration in days. */
  @IsOptional() @IsNumberString() days?: string;
  /** Shift label ("Day"/"Night"/"Weekend"). */
  @IsOptional() @IsString() shift?: string;
  /** Rate per person-day for the chosen shift. */
  @IsOptional() @IsNumberString() rate?: string;
  /** Manual ordering hint within the item (lower first). */
  @IsOptional() @Type(() => Number) @IsInt() sortOrder?: number;
}

/** Sparse-update payload for a plant line; only defined fields are persisted. */
export class UpdatePlantLineDto {
  /** Plant item description. */
  @IsOptional() @IsString() plantItem?: string;
  /** Number of units on site. */
  @IsOptional() @IsNumberString() qty?: string;
  /** Duration in days. */
  @IsOptional() @IsNumberString() days?: string;
  /** Optional free-text comment. */
  @IsOptional() @IsString() comment?: string;
  /** Hire rate per unit-day. */
  @IsOptional() @IsNumberString() rate?: string;
  /** Manual ordering hint within the item (lower first). */
  @IsOptional() @Type(() => Number) @IsInt() sortOrder?: number;
}

/** Sparse-update payload for a waste line; only defined fields are persisted. */
export class UpdateWasteLineDto {
  /** Optional grouping label. */
  @IsOptional() @IsString() wasteGroup?: string;
  /** Waste stream/type. */
  @IsOptional() @IsString() wasteType?: string;
  /** Receiving facility. */
  @IsOptional() @IsString() facility?: string;
  /** Tonnage tipped. */
  @IsOptional() @IsNumberString() qtyTonnes?: string;
  /** Per-tonne rate. */
  @IsOptional() @IsNumberString() tonRate?: string;
  /** Number of truck loads. */
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) loads?: number;
  /** Per-load haulage rate. */
  @IsOptional() @IsNumberString() loadRate?: string;
  /** Manual ordering hint within the item (lower first). */
  @IsOptional() @Type(() => Number) @IsInt() sortOrder?: number;
}

/** Sparse-update payload for a cutting line; only defined fields are persisted. */
export class UpdateCuttingLineDto {
  /** Cutting line type, e.g. "saw", "coreHole", "other". */
  @IsOptional() @IsString() cuttingType?: string;
  /** Equipment used. */
  @IsOptional() @IsString() equipment?: string;
  /** Elevation context. */
  @IsOptional() @IsString() elevation?: string;
  /** Material cut. */
  @IsOptional() @IsString() material?: string;
  /** Cut depth in millimetres (saw cuts). */
  @IsOptional() @Type(() => Number) @IsInt() depthMm?: number;
  /** Hole diameter in millimetres (core holes). */
  @IsOptional() @Type(() => Number) @IsInt() diameterMm?: number;
  /** Quantity in `unit`s. */
  @IsOptional() @IsNumberString() qty?: string;
  /** Quantity unit, e.g. "m", "ea". */
  @IsOptional() @IsString() unit?: string;
  /** Optional free-text comment. */
  @IsOptional() @IsString() comment?: string;
  /** Rate per unit. */
  @IsOptional() @IsNumberString() rate?: string;
  /** Manual ordering hint within the item (lower first). */
  @IsOptional() @Type(() => Number) @IsInt() sortOrder?: number;
}

/** Sparse-update payload for an assumption; only defined fields are persisted. */
export class UpdateAssumptionDto {
  /** The assumption text. */
  @IsOptional() @IsString() text?: string;
  /** Manual ordering hint within the item (lower first). */
  @IsOptional() @Type(() => Number) @IsInt() sortOrder?: number;
}
