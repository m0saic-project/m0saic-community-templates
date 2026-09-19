import type { MosaicTemplate } from "@m0saic/types";
import { type DualSubPreset } from "./policy";
import { type DualSubLayoutKind, type DualSubSizeProfile } from "./layout";
/**
 * @m0saic-dev/language/dual-sub/v1 — the language-learning dual-subtitle renderer.
 *
 * One video + a target-language and a native-language subtitle track (embedded
 * text tracks, or external .srt/.ass files passed as additional inputs) → one
 * learning render. The `support` dial (100 = full native help → 0 = raw)
 * drives coverage, reveal delay, and de-emphasis; presets are named levels on
 * the dial. Deterministic: seeded omission, no clocks, no randomness.
 *
 * Design doc: the internal language-learning-template-design notes
 */
export type DualSubProps = {
    sourceId?: string;
    targetSubsSourceId?: string;
    targetLanguage?: string;
    targetTrackIndex?: number;
    targetOffsetMs?: number;
    nativeSubsSourceId?: string;
    nativeLanguage?: string;
    nativeTrackIndex?: number;
    nativeOffsetMs?: number;
    nativeDelayMs?: number;
    nativeOpacity?: number;
    revealStyle?: "cut" | "fade" | "unblur";
    preset?: DualSubPreset;
    support?: number;
    layout?: DualSubLayoutKind;
    seed?: number;
    stripSdh?: boolean;
    sizeProfile?: DualSubSizeProfile;
    clipStartMs?: number;
    clipEndMs?: number;
};
export declare const DUAL_SUB_TEMPLATE_ID: import("@m0saic/types").TemplateId;
export declare const DualSub: MosaicTemplate<DualSubProps>;
