import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested
} from "class-validator";
import { Type } from "class-transformer";

// PR A1 (2026-05-16) — 4-code discipline system (DEM/CIV/ASB/Other).
export const DISCIPLINES = ["DEM", "CIV", "ASB", "Other"] as const;
// Row-type slugs accepted by the API. The first six entries are the legacy
// names (kept so historical rows keep passing validation); the rest are the
// new canonical slugs introduced with the scope redesign and match the
// system `row-types` GlobalList. Discipline × row-type is enforced
// separately in the service.
export const ROW_TYPES = [
  "demolition",
  "cutting",
  "asbestos",
  "excavation",
  "waste",
  "general",
  "asbestos-removal",
  "enclosure",
  "earthworks",
  "waste-disposal",
  "plant-only",
  "general-labour"
] as const;
export const STATUSES = ["draft", "confirmed", "excluded"] as const;
export const SHIFTS = ["Day", "Night", "Weekend"] as const;

export type Discipline = (typeof DISCIPLINES)[number];
export type RowType = (typeof ROW_TYPES)[number];
export type ScopeStatus = (typeof STATUSES)[number];

export class UpdateScopeHeaderDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) siteAddress?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) siteContactName?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(40) siteContactPhone?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) accessConstraints?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsDateString() proposedStartDate?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) durationWeeks?: number | null;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) specialConditions?: string | null;
}

class ScopeItemFieldsBase {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) notes?: string | null;

  // General
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber() men?: number | null;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber() days?: number | null;
  @ApiPropertyOptional() @IsOptional() @IsIn(SHIFTS as unknown as string[]) shift?: string | null;

  // Demolition
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber() sqm?: number | null;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber() m3?: number | null;
  @ApiPropertyOptional() @IsOptional() @IsString() materialType?: string | null;

  // Cutting
  @ApiPropertyOptional() @IsOptional() @IsString() cuttingEquipment?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() elevation?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsInt() depthMm?: number | null;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber() lm?: number | null;
  @ApiPropertyOptional() @IsOptional() @IsInt() coreHoleDiameterMm?: number | null;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber() coreHoleQty?: number | null;

  // Asbestos
  @ApiPropertyOptional() @IsOptional() @IsString() acmType?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() acmMaterial?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() enclosureRequired?: boolean | null;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() airMonitoring?: boolean | null;

  // Excavation
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber() excavationDepthM?: number | null;
  @ApiPropertyOptional() @IsOptional() @IsString() excavationMaterial?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() machineSize?: string | null;

  // Waste
  @ApiPropertyOptional() @IsOptional() @IsString() wasteType?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() wasteFacility?: string | null;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber() wasteTonnes?: number | null;
  @ApiPropertyOptional() @IsOptional() @IsInt() wasteLoads?: number | null;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber() wasteM3?: number | null;

  // Plant days
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber() excavatorDays?: number | null;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber() bobcatDays?: number | null;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber() ewpDays?: number | null;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber() hookTruckDays?: number | null;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber() semiTipperDays?: number | null;
  @ApiPropertyOptional() @IsOptional() @IsString() assetId?: string | null;

  // Redesign additions — generic measurement/material/plant columns.
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber() measurementQty?: number | null;
  @ApiPropertyOptional() @IsOptional() @IsString() measurementUnit?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() material?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() plantAssetId?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() wasteGroup?: string | null;

  // Provisional sum amount (discipline=Prv only; ignored otherwise).
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber() provisionalAmount?: number | null;

  // PR B1.6 — canonical items table columns 6-10. `wasteGroup` (line 108)
  // already exists; the four below complete the canonical column set per
  // docs/Designs/scope-of-works-redesign.md.
  @ApiPropertyOptional({ enum: ["m²", "m³", "t", "ea"] })
  @IsOptional() @IsIn(["m²", "m³", "t", "ea"]) unit?: string | null;

  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber() value?: number | null;

  @ApiPropertyOptional() @IsOptional() @IsString() wasteItem?: string | null;

  @ApiPropertyOptional() @IsOptional() wasteIncluded?: boolean;

  // Scope item may arrive with a specific wbsCode on redesign create.
  @ApiPropertyOptional() @IsOptional() @IsString() wbsCode?: string | null;

  // PR #71 — multi-plant and multi-measurement per row. Arrays of plain
  // objects, shapes are documented in schema.prisma above the fields:
  //   plantItems:   [{ plantRateId?, description, qty, days, unit }]
  //   measurements: [{ qty, unit }]
  @ApiPropertyOptional({ type: "array", items: { type: "object" } })
  @IsOptional()
  @IsArray()
  plantItems?: unknown;

  @ApiPropertyOptional({ type: "array", items: { type: "object" } })
  @IsOptional()
  @IsArray()
  measurements?: unknown;
}

export class CreateScopeItemDto extends ScopeItemFieldsBase {
  @ApiProperty({ enum: DISCIPLINES }) @IsIn(DISCIPLINES as unknown as string[]) discipline!: Discipline;
  @ApiProperty({ enum: ROW_TYPES }) @IsIn(ROW_TYPES as unknown as string[]) rowType!: RowType;
  @ApiProperty() @IsString() @MaxLength(500) description!: string;
}

export class UpdateScopeItemDto extends ScopeItemFieldsBase {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) description?: string;
  @ApiPropertyOptional({ enum: STATUSES }) @IsOptional() @IsIn(STATUSES as unknown as string[]) status?: ScopeStatus;
  @ApiPropertyOptional({ enum: ROW_TYPES }) @IsOptional() @IsIn(ROW_TYPES as unknown as string[]) rowType?: RowType;
  @ApiPropertyOptional() @IsOptional() @IsInt() sortOrder?: number;
}

export class ReorderEntryDto {
  @ApiProperty() @IsString() itemId!: string;
  @ApiProperty() @IsInt() @Min(0) sortOrder!: number;
}

export class ReorderScopeItemsDto {
  @ApiProperty({ type: [ReorderEntryDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ReorderEntryDto)
  order!: ReorderEntryDto[];
}

// ── PR B1 — Scope card DTOs ──────────────────────────────────────────────
export class CreateScopeCardDto {
  @ApiProperty({ description: "Display name (free-form, max 200 chars)." })
  @IsString() @MaxLength(200) name!: string;

  @ApiProperty({ enum: DISCIPLINES, description: "IS discipline (DEM/CIV/ASB/Other)." })
  @IsIn(DISCIPLINES as unknown as string[]) discipline!: Discipline;
}

export class UpdateScopeCardDto {
  @ApiPropertyOptional({ description: "New display name (rename)." })
  @IsOptional() @IsString() @MaxLength(200) name?: string;

  @ApiPropertyOptional({
    enum: DISCIPLINES,
    description:
      "New discipline. Cascades: cardNumber reissued in new discipline, item wbsCodes rewritten, cutting + waste wbsRefs updated."
  })
  @IsOptional() @IsIn(DISCIPLINES as unknown as string[]) discipline?: Discipline;

  // PR B1.6 — Plant column count per card. Plant 1 always visible (so
  // minimum is 1); Plant 2+ added via the "+" button on the rightmost
  // Plant header. Frontend is responsible for confirming with the user
  // before decreasing past a column that has data in it.
  @ApiPropertyOptional({
    minimum: 1,
    description: "Number of Plant columns visible on this card's items table. Minimum 1 (Plant 1 always present)."
  })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) plantColumnCount?: number;

  // PR B1.7 — shared notes blocks for the Cutting and Waste subtables.
  // Pass null to clear. Both are independent and either can be set in
  // the same PATCH without affecting the other.
  @ApiPropertyOptional({ nullable: true, description: "Shared notes for the Cutting subtable (replaces per-row NotesRow)." })
  @IsOptional() @IsString() @MaxLength(8000) cuttingNotes?: string | null;

  @ApiPropertyOptional({ nullable: true, description: "Shared notes for the Waste subtable (replaces per-row notes column)." })
  @IsOptional() @IsString() @MaxLength(8000) wasteNotes?: string | null;
}

// PR B1.7 — Card-scoped create DTO. Discipline is derived server-side
// from the parent card (the legacy CreateScopeItemDto required it as a
// non-nullable validator, which was causing 400s on the redesigned
// "+ Add row" button after B1.6). rowType is optional and defaults to
// "general-labour" when omitted because the canonical 12-column table
// no longer surfaces a row-type concept.
export class CreateScopeItemInCardDto {
  @ApiPropertyOptional({ description: "Initial description (defaults to empty string)." })
  @IsOptional() @IsString() @MaxLength(500) description?: string;

  @ApiPropertyOptional({ enum: ROW_TYPES, description: "Legacy row type (defaults to general-labour)." })
  @IsOptional() @IsIn(ROW_TYPES as unknown as string[]) rowType?: RowType;
}

export class ReorderScopeCardsDto {
  @ApiProperty({ type: [String], description: "Card IDs in desired display order; each gets sortOrder = its index." })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  cardIds!: string[];
}
