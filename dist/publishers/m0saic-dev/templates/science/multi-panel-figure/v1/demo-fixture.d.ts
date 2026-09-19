import type { MosaicColor } from "@m0saic/types";
/** Bundled placeholder charts, in reading order (a 3×2 figure). */
export declare const DEMO_CHART_FILES: readonly string[];
/**
 * Absolute paths to the bundled charts (resolved from this module's dir).
 *
 * asar-translated: inside a packaged Electron app `__dirname` is in `app.asar`,
 * which ffmpeg cannot open. The probe below MUST test the translated path —
 * `existsSync` returns true for the in-asar path, so an untranslated guard
 * reports the charts as available and then hands the renderer a dead path.
 */
export declare const DEMO_CHART_PATHS: readonly string[];
/** True only when every bundled chart is present; else fall back to colors. */
export declare const DEMO_CHARTS_AVAILABLE: boolean;
/** Default demo panel count (a 3×2 figure). */
export declare const DEMO_PANEL_COUNT: number;
/** Fallback panel colors (muted, plot-like; read on both light + dark presets). */
export declare const DEMO_PANEL_COLORS: readonly MosaicColor[];
/** Fallback color for demo panel `i` (the list cycles). */
export declare function demoPanelColor(i: number): MosaicColor;
