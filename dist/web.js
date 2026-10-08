"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.templates = exports.WEB_ENTRY_MODULE = exports.repo = exports.TEMPLATE_REPO = exports.TEMPLATE_PACKS = void 0;
exports.listWebTemplateIds = listWebTemplateIds;
// ── @m0saic/community-templates — BROWSER ENTRY ──────────────────────────
//
// What Mosaic Web bundles (apps/mosaic/web, `platform/templatesClient.ts`),
// beside the official pack's `@m0saic/templates/dist/web`. Mirrors that entry's
// rule: only templates whose transitive imports are node-free, so the
// `templates-web` chunk builds under webpack (react-scripts) without a single
// `fs` / `path` / `child_process` reaching the browser.
//
// Same contract as `./index`: NO registration side effects. This module exports
// plain template objects; the HOST registers them — the web app under the
// community grant (`withExternalTemplateOrigin(…, { trustedNamespaces })`, the
// same grant Desktop gives the pinned community checkout), so `@m0saic-dev/`
// and `@m0saic-community/` ids are honoured there and refused everywhere else.
//
// ⚠️  THE RULE (test-enforced in ./web.test.ts):
//   • in this list ⇒ the template RUNS in Mosaic Web — its `/make?t=<id>` link
//     opens live, with every media prop empty (the browser has no files), so the
//     template's EMPTY-MEDIA look is what people play with. Author stand-ins
//     for every media slot (the "empty media = demo" convention,
//     `.ai/proposed-plans/outreach-templates.md` §4).
//   • a template with a REQUIRED media / folder / file prop never enters this
//     list — it could only ever render an error card here. It stays a web CARD
//     (`apps/mosaic/web/community-web-cards.json`): preview video + Desktop
//     hand-off.
//   • a node import anywhere in the closure BREAKS `npm run build:web`.
//
// EXCLUDED today (and why):
//   • `@m0saic-community/hello-world/v1` — `node:fs` probe for the baked mark
//   • science/multi-panel-figure/v1 — `node:fs` probe for the bundled demo charts
//   • music/lyric-video/v1 — REQUIRED audio prop
//
// creator/drop-calendar/v1 imports the node-only starter-media helper
// (`@m0saic/template-utils/dist/media/defaultMedia`); it runs here because
// that package's `browser` field swaps the module for its browser twin
// (`defaultMedia.browser`, inline SVG data-URIs) in a browser bundle — the
// frozen template is unchanged. The test below allows exactly the deep imports
// that field maps.
//
// The build writes the ids this entry carries to `web-template-ids.json`
// (`gen-web-template-ids.ts`), the file the web app's asset copy step reads to
// mirror these templates' previews and browse rows.
// FIRST: declare the repo's catalog (0.3.1) — the web host imports this entry
// INSIDE its community origin scope, so the declaration and the registrations
// it then makes share one origin (see ./catalog).
require("./catalog");
const drop_calendar_1 = require("./publishers/m0saic-dev/templates/creator/drop-calendar/v1/drop-calendar");
const new_video_story_1 = require("./publishers/m0saic-dev/templates/creator/new-video-story/v1/new-video-story");
const tip_goal_1 = require("./publishers/m0saic-dev/templates/creator/tip-goal/v1/tip-goal");
const search_typing_1 = require("./publishers/m0saic-dev/templates/hero/search-typing/v1/search-typing");
const dual_sub_1 = require("./publishers/m0saic-dev/templates/language/dual-sub/v1/dual-sub");
const dvd_wrap_1 = require("./publishers/m0saic-dev/templates/print/dvd-wrap/v1/dvd-wrap");
const pipeline_review_1 = require("./publishers/m0saic-dev/templates/sales/pipeline-review/v1/pipeline-review");
const chipset_1 = require("./publishers/m0saic-dev/templates/integrations/chipset/v1/chipset");
const personal_offer_1 = require("./publishers/m0saic-dev/templates/retail/personal-offer/v1/personal-offer");
const run_recap_1 = require("./publishers/m0saic-dev/templates/devops/run-recap/v1/run-recap");
const weekly_brief_1 = require("./publishers/m0saic-dev/templates/insights/weekly-brief/v1/weekly-brief");
const visual_diff_1 = require("./publishers/m0saic-dev/templates/devtools/visual-diff/v1/visual-diff");
var repo_1 = require("./repo");
Object.defineProperty(exports, "TEMPLATE_PACKS", { enumerable: true, get: function () { return repo_1.TEMPLATE_PACKS; } });
Object.defineProperty(exports, "TEMPLATE_REPO", { enumerable: true, get: function () { return repo_1.TEMPLATE_REPO; } });
Object.defineProperty(exports, "repo", { enumerable: true, get: function () { return repo_1.repo; } });
/** The built entry's path from the package root — what the manifest-style
 *  `web-template-ids.json` names, for parity with the official pack. */
exports.WEB_ENTRY_MODULE = "./dist/web.js";
/**
 * Every community template Mosaic Web can run, in stable order. A subset of
 * the node entry's `templates` (asserted by the sibling test): a template on
 * the web is always also a Desktop template, never the reverse.
 */
exports.templates = [
    drop_calendar_1.DropCalendarV1,
    new_video_story_1.NewVideoStoryV1,
    tip_goal_1.TipGoalV1,
    search_typing_1.SearchTyping,
    dual_sub_1.DualSub,
    dvd_wrap_1.DvdWrapV1,
    // sales + integrations (2026-10-06, the outreach lane's first batch): data
    // in as json / strings, no media prop — the browser shows the real thing.
    pipeline_review_1.PipelineReviewV1,
    chipset_1.ChipsetV1,
    // retail + devops + insights + devtools (2026-10-07, the second batch, from
    // the demo-lab workspace): data in as json / strings; the brand logo is an
    // OPTIONAL media prop (the wordmark text stands in), so the browser runs
    // them as they are. Weekly Brief nests the official charts by id.
    personal_offer_1.PersonalOfferV1,
    run_recap_1.RunRecapV1,
    weekly_brief_1.WeeklyBriefV1,
    visual_diff_1.VisualDiffV1,
    // The same widening the publisher table performs (`require(…) as
    // PublisherModule`): a template's own props type is narrower than
    // `MosaicTemplateProps`, which the erased host-facing shape cannot express.
];
/** The ids above, sorted — what `web-template-ids.json` carries. */
function listWebTemplateIds() {
    return exports.templates.map((t) => String(t.id)).sort();
}
