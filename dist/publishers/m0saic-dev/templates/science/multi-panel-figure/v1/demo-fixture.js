"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEMO_PANEL_COLORS = exports.DEMO_PANEL_COUNT = exports.DEMO_CHARTS_AVAILABLE = exports.DEMO_CHART_PATHS = exports.DEMO_CHART_FILES = void 0;
exports.demoPanelColor = demoPanelColor;
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
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const assetPath_1 = require("@m0saic/template-utils/dist/m0saic/assetPath");
/** Bundled placeholder charts, in reading order (a 3×2 figure). */
exports.DEMO_CHART_FILES = [
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
exports.DEMO_CHART_PATHS = exports.DEMO_CHART_FILES.map((f) => (0, assetPath_1.bundledAssetPath)((0, node_path_1.resolve)(__dirname, "assets"), f));
/** True only when every bundled chart is present; else fall back to colors. */
exports.DEMO_CHARTS_AVAILABLE = exports.DEMO_CHART_PATHS.every((p) => (0, node_fs_1.existsSync)(p));
/** Default demo panel count (a 3×2 figure). */
exports.DEMO_PANEL_COUNT = exports.DEMO_CHART_FILES.length;
/** Fallback panel colors (muted, plot-like; read on both light + dark presets). */
exports.DEMO_PANEL_COLORS = [
    "#4c72b0",
    "#dd8452",
    "#55a868",
    "#c44e52",
    "#8172b3",
    "#937860",
    "#da8bc3",
    "#8c8c8c",
];
/** Fallback color for demo panel `i` (the list cycles). */
function demoPanelColor(i) {
    return exports.DEMO_PANEL_COLORS[i % exports.DEMO_PANEL_COLORS.length];
}
