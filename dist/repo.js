"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.repo = exports.TEMPLATE_PACKS = exports.TEMPLATE_REPO = void 0;
const types_1 = require("@m0saic/types");
/**
 * Repo descriptor — embedded into `template-manifest.json` by the generator.
 *
 * `repoId` is the canonical single-segment repo scope (no slashes). Template
 * ids in this repo are PUBLISHER-scoped (`@<publisher>/<pack>/<slug>/vN`),
 * so the repoId is a repo identity for grouping/trust display, not an id
 * prefix.
 *
 * `homepage` is the public GitHub home (D2). It is DISPLAY, never trust: the
 * host stamps provenance from where it loaded the bytes, and the lookalike
 * classifier deliberately ignores homepage (every un-edited starter fork
 * carries one). Mirrors: `COMMUNITY_GITHUB_REPO_DEFAULT` in
 * apps/mosaic/electron/communityRepo.js and `PUBLIC_REPO` in
 * scripts/sync-community-templates.mjs.
 */
exports.TEMPLATE_REPO = {
    schemaVersion: 1,
    repoId: (0, types_1.asRepoId)("@m0saic-community"),
    displayName: "Mosaic Community Templates",
    description: "Curated community templates for m0saic. Verified and approved by the m0saic team.",
    curator: "m0saic",
    homepage: "https://github.com/m0saic-project/m0saic-community-templates",
    assets: {
        templatesDir: "assets/templates",
    },
    // The front door: what `m0saic hello-world --community-repo <this>` renders
    // and what Make's "Start here" points at. `--community-repo`, not
    // `--template-repo`: the id sits in a reserved namespace that only the
    // verified community load is granted — as an ordinary repo it is refused.
    //
    // Its mark is the Community M, re-baked on every release. That makes this
    // the ONE id whose rendered frame drifts by design: the CODE is frozen at
    // v1 (a layout / prop / reveal change is v2), but the mark PNG and the
    // three preview assets are replaced per release. "Same id renders the
    // same" holds per community release, not across them — nothing pins an
    // old M, on purpose.
    helloWorld: (0, types_1.asTemplateId)("@m0saic-community/hello-world/v1"),
    // The template-convention line this repo targets (m0saic 0.3.1): the checks
    // hold its templates to the rules up to it; newer rules are advice until it moves.
    conventions: "0.3.1",
};
/**
 * Named packs in this repo. Pack ids match the `{pack}` segment of member
 * template ids and each descriptor carries its publisher handle — with
 * publisher-scoped ids, `(publisher, pack)` is the real grouping key; the
 * per-entry `publisher` manifest field disambiguates if two publishers ever
 * ship the same pack name.
 *
 * The front door (`@m0saic-community/hello-world/v1`) is PACKLESS and so has
 * no entry here — a one-card pack invented purely to satisfy the grammar is
 * a dead rail section. `parseTemplateId` treats the 3-segment shape as the
 * first-class community convention; the pack lint in `tools/check-deps.mjs`
 * skips packless ids for the same reason.
 *
 * `mermaid` has NO descriptor on purpose: the pack is DISCONNECTED in-tree
 * (2026-09-07, `@dagrejs/dagre`) and excluded from the public snapshot
 * (`EXCLUDED_PACKS` in `scripts/sync-community-templates.mjs`). An advertised
 * pack with zero members is a dead end in the browse rail. Restore this entry
 * in the same change that re-registers the pack.
 */
exports.TEMPLATE_PACKS = [
    {
        id: "creator",
        title: "Creator Tools",
        description: "Schedule posters and stream overlays for people who publish on a cadence: a monthly drop calendar and a tip-goal bar.",
        publisher: "m0saic-dev",
    },
    {
        id: "hero",
        title: "Hero Banners",
        description: "Looping hero animations for landing pages and product sites — the motion above the fold, rendered rather than hand-animated.",
        publisher: "m0saic-dev",
    },
    {
        id: "language",
        title: "Language Learning",
        description: "Comprehensible-input tooling for learners: media in, graded bilingual subtitle burns out, with the support level as a dial.",
        publisher: "m0saic-dev",
    },
    {
        id: "music",
        title: "Music",
        description: "Music-driven templates: songs in, timed visuals out — starting with the tap-to-time lyric video.",
        publisher: "m0saic-dev",
    },
    {
        id: "print",
        title: "Print Production",
        description: "Physical-production templates with dielines, validation records, and batch-ready press artifacts.",
        publisher: "m0saic-dev",
    },
    {
        id: "science",
        title: "Science & Publication",
        description: "Figures for papers and preprints: panel composition with byte-exact, lossless output for reproducible submissions.",
        publisher: "m0saic-dev",
    },
    {
        id: "sales",
        title: "Sales",
        description: "Leadership dashboards from a Salesforce export: the quarter's pipeline as a guided walkthrough with your notes, every number derived from the deals you paste.",
        publisher: "m0saic-dev",
    },
    {
        id: "integrations",
        title: "Integrations",
        description: "Your product at the centre of its partner map: a chip on a circuit board, every partner a pill, every trace lit in turn.",
        publisher: "m0saic-dev",
    },
    {
        id: "retail",
        title: "Retail",
        description: "The ad is a row of customer data: a promo clip addressed to one customer, every field a prop, a thousand customers a loop over a thousand rows.",
        publisher: "m0saic-dev",
    },
    {
        id: "devops",
        title: "Devops",
        description: "What a pipeline sends when it is done: the run recap as a clip, every step, stat and cost from the run record.",
        publisher: "m0saic-dev",
    },
    {
        id: "insights",
        title: "Insights",
        description: "The Monday brief as a video: stat tiles with sparklines from the questions a data layer answered, the same brief every week with only the numbers moving.",
        publisher: "m0saic-dev",
    },
    {
        id: "devtools",
        title: "Devtools",
        description: "Main vs this PR: two browser captures diffed element to element, drawn as wireframes with every change numbered and visited by a camera.",
        publisher: "m0saic-dev",
    },
];
// `repo` is the named export the platform's template-repo loader looks for
// (see `loadTemplateRepoFromPath.ts`). Aliased to TEMPLATE_REPO so existing
// consumers keep working.
exports.repo = exports.TEMPLATE_REPO;
