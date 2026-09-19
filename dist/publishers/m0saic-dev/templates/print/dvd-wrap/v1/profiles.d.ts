import type { MosaicColor, MosaicSource } from "@m0saic/types";
import type { TerritoryProfile } from "@m0saic/template-utils";
import type { DvdTerritoryId } from "./props";
export type SeededTerritoryId = Exclude<DvdTerritoryId, "custom">;
export declare const SEEDED_TERRITORY_PROFILES: Readonly<Record<SeededTerritoryId, TerritoryProfile>>;
/** Clearly unofficial preview-only badge: neutral frame + literal certification. */
export declare function placeholderBadgeSources(certification: string, color?: MosaicColor): MosaicSource[];
