import type { MosaicSubtitleCue } from "@m0saic/types";
/**
 * The support dial: 100 = full native-language help, 0 = raw target language.
 * Levels are the user-facing course settings; every knob below derives from
 * the dial and is individually overridable via props.
 */
export declare const DUAL_SUB_PRESETS: {
    readonly "training-wheels": 90;
    readonly "try-first": 65;
    readonly "half-wheels": 40;
    readonly "safety-net": 20;
    readonly solo: 5;
    readonly "cold-turkey": 0;
};
export type DualSubPreset = keyof typeof DUAL_SUB_PRESETS;
export type DualSubPolicy = {
    support: number;
    /** Fraction of native cues shown (seeded selection). */
    nativeCoverage: number;
    /** Native reveal delay as a fraction of cue duration (0 = immediate). */
    nativeDelayPct: number;
    nativeDelayMinMs: number;
    nativeDelayMaxMs: number;
    /** Whole-source opacity of the native line (de-emphasis). */
    nativeOpacity: number;
    /** Native font size as a fraction of the target font size. */
    nativeScale: number;
    targetVisible: boolean;
};
export declare function resolveSupport(preset: DualSubPreset, supportOverride?: number): number;
export declare function derivePolicy(support: number): DualSubPolicy;
/** Deterministic seeded RNG (mulberry32). Same seed → same sequence, always. */
export declare function mulberry32(seed: number): () => number;
export type NativeCueDecision = {
    cue: MosaicSubtitleCue;
    shown: boolean;
    /** Output-relative time the native line becomes visible (>= cue.startMs). */
    revealMs: number;
};
/**
 * Per-cue native-line decisions: seeded coverage draw + reveal delay.
 * One RNG draw per cue regardless of outcome, so a coverage change never
 * reshuffles which cues survive at the same seed.
 */
export declare function decideNativeCues(cues: readonly MosaicSubtitleCue[], policy: DualSubPolicy, seed: number, 
/** Fixed per-cue delay override (ms); wins over the policy-derived delay. */
fixedDelayMs?: number): NativeCueDecision[];
