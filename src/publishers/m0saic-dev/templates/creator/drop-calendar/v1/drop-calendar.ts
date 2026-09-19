import type {
  MosaicEngineContext,
  MosaicOutputFormat,
  MosaicRenderableFile,
} from "@m0saic/types";
import { asTemplateId } from "@m0saic/types";
import {
  defineMosaicTemplate,
  makeErrorMosaic,
  resolveOutputDurationMs,
  withGeometryContract,
  withLayoutContract,
} from "@m0saic/template-utils";

import { DropCalendarPropsSchema, type DropCalendarV1Props } from "./types";
import { classifyMedia, resolveDropCalendar } from "./resolve";
import { buildDropCalendarDoc } from "./compose";
import { resolveFacecamReel, type FacecamReelOutcome } from "./facecamReel";
import { resolveCreatorPlatform } from "./platforms";

/**
 * Drop Calendar — a monthly content-drop calendar for YouTubers, streamers
 * and musicians: the calendar-on-the-wall look (month + year masthead,
 * weekday header, day grid) driven by data. Pick month + year, list the
 * days something goes out (an upload, a stream, a single — a teaser
 * image/video or a styled title per day), brand the weekdays you post on
 * ("New Music Friday", "Stream Saturday"), and pick a theme (studio / classic
 * / noir / holidays). The PLATFORM is the first-class output choice: it
 * picks the canvas the doc authors (an explicit user size still wins) and
 * the safe area the card lays out in; portrait and square canvases reflow
 * the drop titles into a list under the grid. Optional facecam video sits beside the
 * calendar — cut to the region(s) picked on the clip scrubber, stitched into
 * a reel with a transition when there are several; a cue track timed against
 * the facecam ring-highlights the day being discussed and can superimpose
 * that day's teaser over the table.
 *
 * Deterministic: output depends only on props + ctx.target (+ engine media
 * probes). No RNG, no wall-clock; the month grid is pure arithmetic.
 * A fully static calendar (no facecam, no cues, no cell video) authors a
 * PNG poster; anything animated authors an MP4. An explicit host format
 * always wins.
 */

const TEMPLATE_ID = "@m0saic-dev/creator/drop-calendar/v1";
// 20 s: long enough to walk six drops with a beat each (a 15 s default cut
// the last two off in Make, which seeds its Duration from this hint). With
// a facecam and no explicit duration the render follows the facecam anyway.
const DEFAULT_DURATION_MS = 20_000;
const DEFAULT_ERROR_WIDTH = 1920;
const DEFAULT_ERROR_HEIGHT = 1080;

const PNG_FORMAT: MosaicOutputFormat = { kind: "image", container: "png" };
const VIDEO_FORMAT: MosaicOutputFormat = { kind: "video", container: "mp4" };

const DESCRIPTION =
  "A monthly content-drop calendar for YouTubers, streamers and musicians. Pick the platform (YouTube, Shorts, TikTok, Reels, Stories, Instagram feed, Twitch, X) and the calendar authors that canvas and lays out inside its safe area — clear of the action rail and chrome, titles reflowed into a list on portrait and square. Month + year masthead, branded weekday columns ('New Music Friday', 'Stream Saturday'), and day cells filled by teaser images/videos or styled titles for uploads, streams and releases. Optional facecam — beside the calendar on landscape, a corner picture-in-picture over it on portrait, or exactly where you draw it (Facecam area) — trimmed to the clip region(s) you pick on the scrubber, played back-to-back with a transition when you pick several — plus a cue track that highlights the day being talked about and can superimpose its teaser over the table. Eight themes (studio dark stage, classic print, noir, holidays); renders a PNG poster when static, MP4 when animated; desktop / square / portrait aware.";

type MediaProbe = { kind?: string; durationMs?: number };

function probeMedia(
  ctx: MosaicEngineContext,
  path: string,
): MediaProbe | undefined {
  const registry = (ctx as { media?: Record<string, MediaProbe> }).media;
  return registry?.[path];
}

/**
 * Render length — the duration-follow law: an EXPLICIT ask (CLI --durationMs,
 * Make's Duration field) wins; else the render follows the facecam (the
 * picked clips' reel when the user cut one, else the whole facecam); else
 * the host's target, which hosts seed from the 20 s hint. The host target
 * must never outrank the facecam on its own — it is seeded from the hint,
 * and reading it as an ask cut every walkthrough at the hint length.
 */
function resolveDurationMs(
  ctx: MosaicEngineContext,
  facecamProbe: MediaProbe | undefined,
  reelTotalMs: number | undefined,
): number {
  const natural =
    typeof reelTotalMs === "number" && Number.isFinite(reelTotalMs) && reelTotalMs > 0
      ? reelTotalMs
      : facecamProbe?.durationMs;
  const d = resolveOutputDurationMs(ctx, {
    ...(typeof natural === "number" && Number.isFinite(natural) && natural > 0 ? { naturalMs: natural } : {}),
  });
  return typeof d === "number" && Number.isFinite(d) && d > 0 ? Math.round(d) : DEFAULT_DURATION_MS;
}

function calendarError(ctx: MosaicEngineContext, code: string, message: string) {
  const card = makeErrorMosaic(message, {
    width: ctx?.target?.width ?? DEFAULT_ERROR_WIDTH,
    height: ctx?.target?.height ?? DEFAULT_ERROR_HEIGHT,
    title: "Drop Calendar",
    errorCode: code,
  });
  // The wrapper's timing assertion needs a duration even on the error card
  // (the test ctx may carry none).
  return { ...card, durationMs: card.durationMs ?? DEFAULT_DURATION_MS };
}

export const DropCalendarV1 = defineMosaicTemplate<DropCalendarV1Props>({
  id: asTemplateId(TEMPLATE_ID),
  label: "Drop Calendar",
  version: 1,
  description: DESCRIPTION,
  role: "renderable",
  capabilities: { tier: "core" },
  // Facets the gallery reads: `social` = category, `animated` = motion; the
  // rest are the creator vocabulary people search by.
  tags: ["creator", "calendar", "schedule", "social", "animated", "youtube", "twitch", "tiktok", "instagram", "shorts", "reels", "youtuber", "streamer", "musician", "facecam", "content-plan", "renderable", "creators"],
  platforms: ["desktop", "mobile", "square"],
  internal: false,

  outputHints: {
    width: 1920,
    height: 1080,
    fps: 30,
    durationMs: DEFAULT_DURATION_MS,
    posterTimeMs: 0,
    note:
      "The Platform knob picks the canvas via resolveOutputHints (hosts seed the target from it; an explicit -w/-h wins) and the safe area. Aspect-aware: renders desktop (16:9), square (1:1), and portrait (9:16) layouts from the resulting size. Static calendars (no facecam / cues / cell video) author a PNG poster by default; an explicit output format wins. With a facecam and no explicit duration, the render follows the picked facecam clips — or the whole facecam's length when none are picked.",
  },

  propsSchema: DropCalendarPropsSchema,

  // The platform decides the canvas; hosts seed the render target from
  // this BEFORE rendering (CLI plan size, Make's Device anchor), and an
  // explicit user size still wins at the host. "canvas" returns nothing —
  // the static hints stand. `render` reads the result back from ctx.target
  // like every other template.
  resolveOutputHints: (props) => {
    const canvas = resolveCreatorPlatform(props.platform).canvas;
    return canvas ? { width: canvas.width, height: canvas.height } : {};
  },

  defaultProps: {
    platform: "youtube",
    month: 10,
    year: 2026,
    weekStart: "sunday",
    days: [
      { day: 2, title: "New single out" },
      { day: 8, title: "Vlog: studio week" },
      { day: 13, title: "Music video premiere" },
      { day: 20, title: "Live Q&A 8pm" },
      { day: 26, title: "Acoustic stream" },
      { day: 31, title: "Members early access" },
    ],
    teasers: [],
    weekdays: {
      sunday: "",
      monday: "",
      tuesday: "",
      wednesday: "",
      thursday: "",
      friday: "New Music Friday",
      saturday: "Stream Saturday",
    },
    facecam: "",
    facecamSlot: false,
    safeArea: true,
    showChrome: false,
    facecamCorner: "top-left",
    facecamSize: 0.34,
    facecamStrokePx: 2,
    facecamStrokeColor: "",
    facecamClips: [],
    facecamTransition: { style: "fade", durationSec: 0.4 },
    facecamAudio: true,
    muteTeasers: true,
    cues: [],
    holdSec: 4,
    spotlight: { enabled: true, sizeFrac: 0.62, dim: true, delaySec: 1 },
    theme: "studio",
    accentColor: "",
    backgroundColor: "",
    fontFamily: "Roboto",
    look: {
      cellMediaFit: "cover",
      showTitles: true,
      showDayNumbers: true,
      dimAdjacent: true,
    },
    debugLayout: false,
    debugGeometry: false,
  },

  async render(
    props: DropCalendarV1Props,
    ctx: MosaicEngineContext,
  ): Promise<MosaicRenderableFile> {
    // The canvas is the host's target — seeded from `resolveOutputHints`
    // (the platform's canvas) by hosts that honour it, whatever the user
    // asked for otherwise. The platform still shapes the SAFE AREA at any
    // size, so a host that ignores the resolver gets a correct layout too.
    const W = ctx?.target?.width ?? DEFAULT_ERROR_WIDTH;
    const H = ctx?.target?.height ?? DEFAULT_ERROR_HEIGHT;
    const fps = ctx?.target?.fps ?? 30;

    const facecamPath = typeof props.facecam === "string" ? props.facecam.trim() : "";
    const facecamProbe = facecamPath !== "" ? probeMedia(ctx, facecamPath) : undefined;
    if (facecamProbe?.kind === "image" || facecamProbe?.kind === "audio") {
      return calendarError(
        ctx,
        "DC_FACECAM_KIND",
        `The facecam must be a video — ${JSON.stringify(facecamPath)} probed as ${facecamProbe.kind}.`,
      );
    }

    // The picked facecam regions, judged against the probed source length.
    // Resolved before the duration because a reel with no host duration IS
    // the render length, and before the config because the cue track maps
    // through it.
    const facecamReel: FacecamReelOutcome =
      facecamPath !== ""
        ? resolveFacecamReel(props.facecamClips, {
            ...(facecamProbe?.durationMs !== undefined
              ? { sourceDurationMs: facecamProbe.durationMs }
              : {}),
            transitionStyle: props.facecamTransition?.style,
            transitionSec: props.facecamTransition?.durationSec,
          })
        : { warnings: [] };

    const durationMs = resolveDurationMs(ctx, facecamProbe, facecamReel.reel?.totalMs);

    const resolved = resolveDropCalendar(props, durationMs / 1000, facecamReel);
    if (!resolved.ok) return calendarError(ctx, resolved.code, resolved.message);

    const built = buildDropCalendarDoc(
      resolved.cfg,
      W,
      H,
      fps,
      durationMs,
      (path) => classifyMedia(path, probeMedia(ctx, path)?.kind),
    );
    if (!built.ok) return calendarError(ctx, built.code, built.message);

    // L1 format intent: a fully static calendar is a poster (PNG); anything
    // animated is a video. The host's explicit format (L0) outranks this.
    built.doc.format = built.stats.animated ? VIDEO_FORMAT : PNG_FORMAT;

    // Dev tripwires — EXCLUSIVE, never chained: each debug wrapper REPLACES
    // the doc with its contract wireframe, so running the layout contract on
    // the geometry contract's wireframe reports every label as missing (the
    // "label didn't land in this m0" trap). Geometry wins when both are on.
    if (props.debugGeometry === true) {
      // Replays the engine's inset floor math against every piece's EXACT
      // intent rect — zero drift is the inset-recovery contract.
      return withGeometryContract(built.doc, ctx, {
        templateId: TEMPLATE_ID,
        expectations: built.expectations,
        debug: true,
      });
    }
    // Masthead text fits its band (all-caps em); sheet/table present.
    return withLayoutContract(built.doc, ctx, {
      templateId: TEMPLATE_ID,
      constraints: [
        { label: "masthead", textFits: { charWidthEm: 0.76 } },
        { label: "paper" },
        { label: "panel" },
      ],
      debug: props.debugLayout === true,
    });
  },
});


