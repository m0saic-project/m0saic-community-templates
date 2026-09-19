import { DropCalendarV1, NewVideoStoryV1, TipGoalV1 } from "./templates/creator";
import { DualSub } from "./templates/language/dual-sub/v1";
import { LyricVideo } from "./templates/music";
import { SearchTyping } from "./templates/hero";
import { DvdWrapV1 } from "./templates/print/dvd-wrap/v1";
import { MultiPanelFigure } from "./templates/science/multi-panel-figure/v1";

export { publisher } from "./publisher";
export * from "./templates";

/**
 * Every template this publisher ships, in stable order.
 *
 * NOTE: `MermaidFlowchartV1` is DISCONNECTED (2026-09-07) — not unbuilt, just
 * unregistered. Its `@dagrejs/dagre` dependency would have to enter the
 * template-repo dep allowlist (and therefore apps/mosaic) to ship, which is a
 * policy widening the pack isn't worth today. Source + tests stay in-tree and
 * dagre stays a devDependency; re-register it once dagre is vendored. Template modules
 * export plain template objects — they do NOT self-register; the host (or
 * the package entry) decides what to register.
 */
export const templates = [
  DropCalendarV1,
  NewVideoStoryV1,
  TipGoalV1,
  DualSub,
  SearchTyping,
  LyricVideo,
  DvdWrapV1,
  MultiPanelFigure,
];
