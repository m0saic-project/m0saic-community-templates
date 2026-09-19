import type { MosaicSubtitleCue } from "@m0saic/types";

/**
 * The support dial: 100 = full native-language help, 0 = raw target language.
 * Levels are the user-facing course settings; every knob below derives from
 * the dial and is individually overridable via props.
 */
export const DUAL_SUB_PRESETS = {
  "training-wheels": 90,
  "try-first": 65,
  "half-wheels": 40,
  "safety-net": 20,
  solo: 5,
  "cold-turkey": 0,
} as const;

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

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Piecewise-linear interpolation through sorted [x, y] anchor points. */
function interp(points: ReadonlyArray<readonly [number, number]>, x: number): number {
  if (x <= points[0][0]) return points[0][1];
  for (let i = 1; i < points.length; i++) {
    const [x1, y1] = points[i];
    if (x <= x1) {
      const [x0, y0] = points[i - 1];
      return y0 + ((x - x0) / (x1 - x0)) * (y1 - y0);
    }
  }
  return points[points.length - 1][1];
}

const COVERAGE_ANCHORS: ReadonlyArray<readonly [number, number]> = [
  [0, 0],
  [5, 0],
  [20, 0.15],
  [40, 0.4],
  [60, 1],
  [100, 1],
];

export function resolveSupport(preset: DualSubPreset, supportOverride?: number): number {
  if (supportOverride !== undefined && Number.isFinite(supportOverride)) {
    return clamp(supportOverride, 0, 100);
  }
  return DUAL_SUB_PRESETS[preset];
}

export function derivePolicy(support: number): DualSubPolicy {
  const s = clamp(support, 0, 100);
  return {
    support: s,
    nativeCoverage: interp(COVERAGE_ANCHORS, s),
    // Founder-calibrated: the delay must be a real beat ("try first" needs
    // actual wait time), so it starts at 20% of the cue even just below the
    // no-delay threshold and grows to 60% at low support.
    nativeDelayPct: s >= 80 ? 0 : s <= 20 ? 0.6 : 0.2 + ((80 - s) / 60) * 0.4,
    nativeDelayMinMs: 700,
    nativeDelayMaxMs: 2600,
    // Floor calibrated on real footage (founder round 3): the gray line must
    // stay readable — de-emphasis is carried mostly by size + color, opacity
    // only trims the top. Overridable per render via the nativeOpacity prop.
    nativeOpacity: 0.65 + (s / 100) * 0.2,
    nativeScale: 0.65 + (s / 100) * 0.1,
    targetVisible: s >= 3,
  };
}

/** Deterministic seeded RNG (mulberry32). Same seed → same sequence, always. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

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
export function decideNativeCues(
  cues: readonly MosaicSubtitleCue[],
  policy: DualSubPolicy,
  seed: number,
  /** Fixed per-cue delay override (ms); wins over the policy-derived delay. */
  fixedDelayMs?: number,
): NativeCueDecision[] {
  const rng = mulberry32(seed);
  return cues.map((cue) => {
    const draw = rng();
    const shown = policy.nativeCoverage > 0 && draw < policy.nativeCoverage;
    const dur = cue.endMs - cue.startMs;
    const delay =
      fixedDelayMs !== undefined && Number.isFinite(fixedDelayMs)
        ? Math.max(0, fixedDelayMs)
        : policy.nativeDelayPct > 0
          ? clamp(policy.nativeDelayPct * dur, policy.nativeDelayMinMs, policy.nativeDelayMaxMs)
          : 0;
    // Never reveal so late the line can't be read: cap at 80% of the cue.
    const revealMs = cue.startMs + Math.min(delay, dur * 0.8);
    return { cue, shown, revealMs };
  });
}
