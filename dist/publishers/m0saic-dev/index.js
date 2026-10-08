"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.templates = exports.publisher = void 0;
const creator_1 = require("./templates/creator");
const v1_1 = require("./templates/language/dual-sub/v1");
const music_1 = require("./templates/music");
const hero_1 = require("./templates/hero");
const v1_2 = require("./templates/print/dvd-wrap/v1");
const v1_3 = require("./templates/science/multi-panel-figure/v1");
const sales_1 = require("./templates/sales");
const integrations_1 = require("./templates/integrations");
const retail_1 = require("./templates/retail");
const devops_1 = require("./templates/devops");
const insights_1 = require("./templates/insights");
const devtools_1 = require("./templates/devtools");
var publisher_1 = require("./publisher");
Object.defineProperty(exports, "publisher", { enumerable: true, get: function () { return publisher_1.publisher; } });
__exportStar(require("./templates"), exports);
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
exports.templates = [
    creator_1.DropCalendarV1,
    creator_1.NewVideoStoryV1,
    creator_1.TipGoalV1,
    v1_1.DualSub,
    hero_1.SearchTyping,
    music_1.LyricVideo,
    v1_2.DvdWrapV1,
    v1_3.MultiPanelFigure,
    sales_1.PipelineReviewV1,
    integrations_1.ChipsetV1,
    retail_1.PersonalOfferV1,
    devops_1.RunRecapV1,
    insights_1.WeeklyBriefV1,
    devtools_1.VisualDiffV1,
];
