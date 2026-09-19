/**
 * Demo panels for the media-free render (`defaultProps`), so the template reads
 * as a REAL figure everywhere it renders standalone: the Templates-page
 * preview, the always-on registry smoke sweep in
 * `packages/cli/__tests__/templates.official.smoke.test.js`, and the media-free
 * CLI E2E default case.
 *
 * Primary: six BUNDLED mock metric charts (`assets/*.png`, mirrored to dist by
 * copy-assets) — placeholders a user replaces by supplying their own
 * `sourceIds`. Fallback: a muted, plot-like color per panel, for a stripped
 * build where the bundled charts aren't on disk. Templates build to CJS, so
 * `__dirname` resolves the bundled files at render time.
 */
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { bundledAssetPath } from "@m0saic/template-utils/dist/m0saic/assetPath";
import type { MosaicColor } from "@m0saic/types";

/** Bundled placeholder charts, in reading order (a 3×2 figure). */
export const DEMO_CHART_FILES: readonly string[] = [
  "01-renders-per-month.png",
  "02-render-latency.png",
  "03-top-templates.png",
  "04-m0-nodes-ratio.png",
  "05-output-formats.png",
  "06-duration-spread.png",
];

/**
 * Absolute paths to the bundled charts (resolved from this module's dir).
 *
 * asar-translated: inside a packaged Electron app `__dirname` is in `app.asar`,
 * which ffmpeg cannot open. The probe below MUST test the translated path —
 * `existsSync` returns true for the in-asar path, so an untranslated guard
 * reports the charts as available and then hands the renderer a dead path.
 */
export const DEMO_CHART_PATHS: readonly string[] = DEMO_CHART_FILES.map((f) =>
  bundledAssetPath(resolve(__dirname, "assets"), f),
);

/** True only when every bundled chart is present; else fall back to colors. */
export const DEMO_CHARTS_AVAILABLE: boolean = DEMO_CHART_PATHS.every((p) => existsSync(p));

/** Default demo panel count (a 3×2 figure). */
export const DEMO_PANEL_COUNT = DEMO_CHART_FILES.length;

/** Fallback panel colors (muted, plot-like; read on both light + dark presets). */
export const DEMO_PANEL_COLORS: readonly MosaicColor[] = [
  "#4c72b0" as MosaicColor,
  "#dd8452" as MosaicColor,
  "#55a868" as MosaicColor,
  "#c44e52" as MosaicColor,
  "#8172b3" as MosaicColor,
  "#937860" as MosaicColor,
  "#da8bc3" as MosaicColor,
  "#8c8c8c" as MosaicColor,
];

/** Fallback color for demo panel `i` (the list cycles). */
export function demoPanelColor(i: number): MosaicColor {
  return DEMO_PANEL_COLORS[i % DEMO_PANEL_COLORS.length];
}
