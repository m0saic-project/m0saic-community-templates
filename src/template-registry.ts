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
