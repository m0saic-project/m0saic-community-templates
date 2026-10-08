/**
 * Authoring registry for the community template repo.
 *
 * Each entry provides the metadata needed to generate template-manifest.json.
 * This is the single source of truth for browse metadata (title, description,
 * tags, preview paths, per-template author credit) for the community repo.
 * Mirrors `packages/templates/src/template-registry.ts`.
 *
 * ALL exported templates belong here — the manifest generator asserts the
 * registry and `getTemplates()` agree exactly.
 */
import type { MosaicTemplateRepoManifestEntry } from "@m0saic/types";

export type CommunityTemplateRegistryEntry = Omit<
  MosaicTemplateRepoManifestEntry,
  "templateKey"
> & {
  /** The template's id field (= templateKey in manifest). */
  templateId: string;
  /** Named export from dist/index.js (must match barrel export). */
  exportName: string;
  /**
   * Publisher handle credited for the template. REQUIRED in the community
   * repo, and must equal the id's `@<publisher>` first segment (sans `@`).
   */
  author: string;
};

export const templateRegistry: CommunityTemplateRegistryEntry[] = [
  // ── m0saic-community (packless) ────────────────────────────
  // The repo's FRONT DOOR (repo.helloWorld in src/repo.ts). Owned by the
  // repo's own publisher, not the founder's personal handle, and PACKLESS
  // (`@<publisher>/<slug>/vN`) like the built-in front door it mirrors.
  {
    slug: "hello-world",
    templateId: "@m0saic-community/hello-world/v1",
    exportName: "CommunityHelloWorld",
    title: "Hello, World (Community)",
    description:
      "The community repo's front door: the Home screen as a greeting, with the Community M in the mark — the 33-tile brand M where each tile belongs to one contributor. The mark is re-baked on every release, so the card fills in as tiles are claimed. Zero inputs — the first render on a fresh install.",
    tags: ["hello", "brand", "animated", "intro", "card", "community", "front-door", "developers"],
    author: "m0saic-community",
  },

  // ── m0saic-dev / creator ───────────────────────────────────
  {
    slug: "drop-calendar",
    templateId: "@m0saic-dev/creator/drop-calendar/v1",
    exportName: "DropCalendarV1",
    title: "Drop Calendar",
    description:
      "A monthly content-drop calendar for YouTubers, streamers and musicians. Pick the platform (YouTube, Shorts, TikTok, Reels, Stories, Instagram feed, Twitch, X): the calendar authors that canvas and lays out inside its safe area, titles reflowed into a list on portrait and square. Month + year masthead, branded weekday columns ('New Music Friday', 'Stream Saturday'), and day cells filled by teaser images/videos or styled titles for uploads, streams and releases. Optional facecam beside the table cut to the clip regions you pick, plus a cue track that highlights the day being talked about. Eight themes (studio dark stage is the default); PNG poster when static, MP4 when animated; desktop / square / portrait aware.",
    tags: ["creator", "calendar", "schedule", "social", "animated", "youtube", "twitch", "tiktok", "instagram", "shorts", "reels", "youtuber", "streamer", "musician", "facecam", "content-plan", "renderable", "creators"],
    author: "m0saic-dev",
  },
  {
    slug: "new-video-story",
    templateId: "@m0saic-dev/creator/new-video-story/v1",
    exportName: "NewVideoStoryV1",
    title: "New Video Story",
    description:
      "The 'NEW VIDEO' Instagram story for the day something drops. Pick what you're announcing — a YouTube video or Short, a TikTok, a Reel, an Instagram post, a Twitch stream, a podcast episode, an X post — and the preset writes the sticker headline, the boxed call-to-action, the link-pill text, the badge and the accent colour (every one overridable). Drop in your media — an image or a video, the screenshot of your channel or feed, a clip of the drop: it fills the bottom of the story, and you move or resize it in place on the preview. Animated by default — the headline slides in, the badge drops with a bounce, the arrows cascade and keep bobbing, the link pill pops — or a PNG still with animation off. 1080×1920.",
    tags: ["creator", "story", "social", "animated", "instagram", "youtube", "tiktok", "twitch", "shorts", "reels", "podcast", "announcement", "new-video", "youtuber", "streamer", "renderable", "creators"],
    author: "m0saic-dev",
  },
  {
    slug: "tip-goal",
    templateId: "@m0saic-dev/creator/tip-goal/v1",
    exportName: "TipGoalV1",
    title: "Tip Goal",
    description:
      "A streamer-style tip/donation goal bar for any video: a rounded track fills toward a goal while a currency counter ticks up. The generator owns the timeline — a seeded auto tip stream, exact tip rows, or absolute amount keyframes — with tip flashes, preset placements and replaceable art.",
    tags: ["creator", "overlay", "donations", "goal", "renderable", "creators", "social", "animated", "streamer", "twitch", "youtube", "stream-overlay", "donation-bar"],
    author: "m0saic-dev",
  },


  // ── m0saic-dev / language ──────────────────────────────────
  {
    slug: "dual-sub",
    templateId: "@m0saic-dev/language/dual-sub/v1",
    exportName: "DualSub",
    title: "Dual Subtitles (Language Learning)",
    description:
      "Burns target + native language subtitles with a learning support dial: de-emphasis, delayed reveal, seeded omission. Levels from training-wheels to cold-turkey.",
    tags: ["language", "learning", "subtitles", "media", "educators", "creators", "animated", "bilingual", "teacher", "language-learning"],
    author: "m0saic-dev",
  },

  // ── m0saic-dev / sales ─────────────────────────────────────
  {
    slug: "pipeline-review",
    templateId: "@m0saic-dev/sales/pipeline-review/v1",
    exportName: "PipelineReviewV1",
    title: "Pipeline Review",
    description:
      "A quarter's Salesforce opportunities as a leadership dashboard video: closed won, win rate, what slipped past its close month and what is still open, won revenue by month and by region, the deals that need a new close date, and who carried the quarter. Give any headline a note and the video stops on it: the camera zooms in, your note shows below, then it moves on. Every number is derived from the Deals prop, so next quarter is a new paste and a re-render.",
    tags: ["sales", "dashboard", "pipeline", "salesforce", "kpi", "walkthrough", "leadership", "report", "animated", "renderable"],
    author: "m0saic-dev",
  },

  // ── m0saic-dev / integrations ──────────────────────────────
  {
    slug: "chipset",
    templateId: "@m0saic-dev/integrations/chipset/v1",
    exportName: "ChipsetV1",
    title: "Chipset",
    description:
      "Your product as the chip on a circuit board, wired to every partner: a glowing packet runs down each trace in turn and lights the partner's pill. Edit the partner list and the pills re-flow and the traces re-route, one or two rows on a wide canvas, two columns on a phone.",
    tags: ["integrations", "partners", "hero", "circuit", "marketing", "animated", "loop", "landing-page", "marketers", "renderable"],
    author: "m0saic-dev",
  },

  // ── m0saic-dev / retail ────────────────────────────────────
  {
    slug: "personal-offer",
    templateId: "@m0saic-dev/retail/personal-offer/v1",
    exportName: "PersonalOfferV1",
    title: "Personal Offer",
    description:
      "A promo clip addressed to one customer: their name, the product picked for them, their discount and their code. The ad is a row of customer data: a weekly send fills the props per customer and every clip renders inside the same signed-off look. Ships generic product art as inline SVG; a real product shot swaps in.",
    tags: ["retail", "promo", "personalized", "newsletter", "offer", "discount", "beauty", "marketing", "data-driven", "animated", "renderable"],
    author: "m0saic-dev",
  },

  // ── m0saic-dev / devops ────────────────────────────────────
  {
    slug: "run-recap",
    templateId: "@m0saic-dev/devops/run-recap/v1",
    exportName: "RunRecapV1",
    title: "Run Recap",
    description:
      "The report an agent-workflow run sends when it is done: status, trigger, each step with its kind, duration and retries, the outcome, up to four stat tiles, the cost and the link. One more job on run.completed turns the run record into props; the agent writes one sentence, the template keeps every report looking like one.",
    tags: ["devops", "ci", "agents", "workflow", "report", "recap", "notification", "slack", "email", "data-driven", "animated", "renderable"],
    author: "m0saic-dev",
  },

  // ── m0saic-dev / insights ──────────────────────────────────
  {
    slug: "weekly-brief",
    templateId: "@m0saic-dev/insights/weekly-brief/v1",
    exportName: "WeeklyBriefV1",
    title: "Weekly Brief",
    description:
      "The Monday brief as a video: a greeting, one sentence on the week, up to six stat tiles with a signed delta and a sparkline each, the two or three things worth knowing, and where the numbers came from. A brief is a list of questions answered: a data-retrieval layer returns the rows and the caption, the template is where they land, and the exec gets the same video every week with only the numbers moving.",
    tags: ["insights", "kpi", "dashboard", "brief", "executive", "weekly", "email", "agents", "data-driven", "charts", "animated", "renderable"],
    author: "m0saic-dev",
  },

  // ── m0saic-dev / devtools ──────────────────────────────────
  {
    slug: "visual-diff",
    templateId: "@m0saic-dev/devtools/visual-diff/v1",
    exportName: "VisualDiffV1",
    title: "Visual Diff",
    description:
      "main vs this PR: two captures of the same page (any HTML, taken in a real browser) drawn as labelled wireframes side by side, every difference found by matching element to element, outlined and numbered, and visited by a camera with a card per change. Writes each side's layout as an .m0c sidecar with every area labelled, and the diff as JSON: the exact geometry of what changed, not just a picture of it.",
    tags: ["devtools", "visual-regression", "playwright", "e2e", "pull-request", "wireframe", "diff", "layout", "review", "animated", "renderable"],
    author: "m0saic-dev",
  },

  // ── m0saic-dev / hero ──────────────────────────────────────
  {
    slug: "search-typing",
    templateId: "@m0saic-dev/hero/search-typing/v1",
    exportName: "SearchTyping",
    title: "Search Typing",
    description:
      "Looping search-bar hero: a rounded card with a magnifier, a muted prompt, and rotating words typed and deleted character-by-character over a growing underline.",
    tags: ["hero", "search", "typing", "animated", "loop", "marketing", "marketers", "designers", "landing-page", "hero-banner"],
    author: "m0saic-dev",
  },

  // ── m0saic-dev / mermaid ───────────────────────────────────
  // DISCONNECTED 2026-09-07 alongside the publisher-array entry: shipping it
  // would put @dagrejs/dagre into the template-repo dep allowlist (and so into
  // apps/mosaic). Source + tests stay in-tree; restore this entry and the
  // publisher-array entry together once dagre is vendored.

  // ── m0saic-dev / music ─────────────────────────────────────
  {
    slug: "lyric-video",
    templateId: "@m0saic-dev/music/lyric-video/v1",
    exportName: "LyricVideo",
    title: "Lyric Video",
    description:
      "Paste lyrics, tap them in time to your song, get a lyric video: line-timed text over a color or media background, with the render length following the song.",
    tags: ["media", "music", "lyrics", "audio", "animated", "creators", "musicians", "social", "karaoke", "youtube", "tiktok"],
    author: "m0saic-dev",
  },

  // ── m0saic-dev / print ─────────────────────────────────────
  {
    slug: "dvd-wrap",
    templateId: "@m0saic-dev/print/dvd-wrap/v1",
    exportName: "DvdWrapV1",
    title: "DVD Wrap",
    description:
      "Build dieline-exact DVD wrap masters and fan out territory variants with barcodes, rating-art joins, technical specs, legal/distributor blocks, panel renders, proofs, and machine-readable production sidecars.",
    tags: ["print", "packaging", "dvd", "batch", "barcode", "designers", "print-design", "dieline"],
    author: "m0saic-dev",
  },

  // ── m0saic-dev / science ───────────────────────────────────
  {
    slug: "multi-panel-figure",
    templateId: "@m0saic-dev/science/multi-panel-figure/v1",
    exportName: "MultiPanelFigure",
    title: "Multi-Panel Figure",
    description:
      "Compose N image panels into a labeled multi-panel scientific figure — real carved cells per panel, A/B/C panel letters, caption rail, optional scale bar; lossless PNG output for byte-exact reproducibility.",
    tags: ["science", "figure", "panels", "publication", "reproducible", "researchers", "academic", "paper", "journal"],
    author: "m0saic-dev",
  },
];
