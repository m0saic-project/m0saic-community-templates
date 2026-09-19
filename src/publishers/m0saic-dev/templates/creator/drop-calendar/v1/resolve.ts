/**
 * Resolve — raw props → one canonical, validated config. All list props
 * (Drops rows, special weekdays, cues) arrive as untyped JSON; everything is
 * parsed defensively here so compose works on clean data only. Recoverable
 * problems (a day outside the month, an unknown weekday, an untimed cue)
 * are skipped with a warning; only nonsense months/years hard-fail.
 *
 * Cue times arrive as FACECAM-SOURCE ms (that's what the cue studio stamps
 * against) and leave as OUTPUT seconds: with picked facecam clips they are
 * mapped through the reel, and a cue in dropped footage is skipped.
 */

import {
  buildMonthGrid,
  daysInMonth,
  parseCueDay,
  WEEKDAY_KEYS,
  type MonthGrid,
  type WeekStart,
} from "./calendar";
import {
  mapFacecamWindow,
  type FacecamReel,
  type FacecamReelOutcome,
} from "./facecamReel";
import {
  isCalendarThemeName,
  resolveCalendarTheme,
  type CalendarTheme,
} from "./themes";
import type { MosaicRegion } from "@m0saic/types";
import { parseRegionsValue } from "@m0saic/template-utils";

import { MAX_CUES, type DropCalendarV1Props } from "./types";
import { resolveCreatorPlatform, type CreatorPlatform } from "./platforms";

export type MediaKind = "video" | "image";

/** One resolved drop: a valid in-month day, with optional title/teaser. */
export type ResolvedDrop = {
  day: number;
  title: string;
  /** Index into cfg.teasers, or undefined for a text-only drop. */
  teaserIndex?: number;
  /** ORIGINAL index of this row in props.days — canvas prop bindings route
   *  through it, so it must survive filtering/sorting untouched. */
  rowIndex: number;
};

/** One resolved cue window on the output timeline (seconds). */
export type ResolvedCue = {
  day: number;
  startSec: number;
  endSec: number;
};

export type ResolvedConfig = {
  year: number;
  month: number;
  weekStart: WeekStart;
  grid: MonthGrid;
  monthDayCount: number;

  /** Keyed by day-of-month for O(1) cell lookup. */
  dropsByDay: Map<number, ResolvedDrop>;
  /** ORIGINAL props.days row count — empty-date ADD handles bind the next
   *  free index (`days[dayRowCount]`), which `writeLeaf` pads into being. */
  dayRowCount: number;
  teasers: string[];
  /** Header label per weekday 0=Sun..6=Sat; undefined = plain weekday name. */
  specialLabelByWeekday: (string | undefined)[];

  facecam: string;
  /** Show the facecam area with the included starter while `facecam` is
   *  empty (a drop target on the Make canvas). */
  facecamSlot: boolean;
  /** Portrait picture-in-picture placement (ignored on landscape / square). */
  facecamCorner: "top-left" | "top-right" | "bottom-left" | "bottom-right";
  facecamSize: number;
  /** Frame around the facecam: thickness in px (0 = none) and colour ("" = theme). */
  facecamStrokePx: number;
  facecamStrokeColor: string;
  /**
   * The drawn facecam rect (escape hatch), still in its authored canvas —
   * compose rescales it onto the render canvas. Undefined = automatic
   * placement.
   */
  facecamRegion?: { canvas?: { w: number; h: number }; regions: MosaicRegion[] };
  /** Keep the table inside the platform's safe area (false = whole canvas). */
  safeArea: boolean;
  /** Preview aid: paint the platform's chrome as translucent stand-ins. */
  showChrome: boolean;
  /** Picked facecam regions; undefined = play the whole video. */
  facecamReel?: FacecamReel;
  facecamAudio: boolean;
  muteTeasers: boolean;

  cues: ResolvedCue[];
  holdSec: number;
  spotlight: { enabled: boolean; sizeFrac: number; dim: boolean; delaySec: number };

  theme: CalendarTheme;
  /** Where the render is going — canvas + safe area (see platforms.ts). */
  platform: CreatorPlatform;
  fontFamily: string;
  cellMediaFit: "cover" | "contain";
  showTitles: boolean;
  showDayNumbers: boolean;
  dimAdjacent: boolean;
};

export type ResolveOutcome =
  | { ok: true; cfg: ResolvedConfig; warnings: string[] }
  | { ok: false; code: string; message: string };

const num = (v: unknown): number | undefined =>
  typeof v === "number" && Number.isFinite(v) ? v : undefined;

const clamp = (v: number, lo: number, hi: number): number =>
  Math.min(hi, Math.max(lo, v));

const str = (v: unknown): string => (typeof v === "string" ? v : "");

const VIDEO_EXT = /\.(mp4|m4v|mov|webm|mkv|avi|mts|m2ts|ts|wmv|flv)$/i;

/**
 * Classify a media reference as video or image: engine probe first (when the
 * host supplied one), file extension second, image as the safe default (a
 * teaser is most often a thumbnail).
 */
export function classifyMedia(
  path: string,
  probeKind: string | undefined,
): MediaKind {
  if (probeKind === "video") return "video";
  if (probeKind === "image") return "image";
  return VIDEO_EXT.test(path.split("?")[0] ?? path) ? "video" : "image";
}

export function resolveDropCalendar(
  props: DropCalendarV1Props,
  durationSec: number,
  /**
   * The facecam reel, already resolved against the probed source length (the
   * render owns the probe). Omitted = play the whole facecam, and cue times
   * are output times as they always were.
   */
  facecam: FacecamReelOutcome = { warnings: [] },
): ResolveOutcome {
  const warnings: string[] = [...facecam.warnings];
  const reel = facecam.reel;

  // ── Month / year ──
  const month = Math.round(num(props.month) ?? 10);
  const year = Math.round(num(props.year) ?? 2026);
  if (month < 1 || month > 12) {
    return { ok: false, code: "DC_MONTH", message: `Month must be 1-12, got ${month}.` };
  }
  if (year < 1900 || year > 2200) {
    return { ok: false, code: "DC_YEAR", message: `Year must be 1900-2200, got ${year}.` };
  }
  const weekStart: WeekStart = props.weekStart === "monday" ? "monday" : "sunday";
  const grid = buildMonthGrid(year, month, weekStart);
  const monthDayCount = daysInMonth(year, month);

  // ── Teasers ──
  const teasers = Array.isArray(props.teasers)
    ? props.teasers.map(str).map((s) => s.trim()).filter((s) => s !== "")
    : [];

  // ── Drops ──
  const rawDays = Array.isArray(props.days) ? props.days : [];
  const dropsByDay = new Map<number, ResolvedDrop>();
  type PendingDrop = ResolvedDrop & { explicitTeaser?: number };
  const pending: PendingDrop[] = [];
  for (let rowIndex = 0; rowIndex < rawDays.length; rowIndex++) {
    const row = rawDays[rowIndex];
    if (typeof row !== "object" || row === null) continue;
    const r = row as Record<string, unknown>;
    // `day` is an integer by contract; numeric strings and blanks are
    // tolerated defensively (a blank day renders nothing, silently).
    let day = 0;
    if (typeof r.day === "number") {
      day = Math.round(num(r.day) ?? 0);
    } else if (typeof r.day === "string" && r.day.trim() !== "") {
      const n = Number(r.day.trim());
      if (!Number.isFinite(n)) {
        warnings.push(`Drop day ${JSON.stringify(r.day)} is not a number; skipped.`);
        continue;
      }
      day = Math.round(n);
    }
    if (day < 1 || day > monthDayCount) {
      if (day !== 0) warnings.push(`Drop day ${day} is outside ${year}-${month}; skipped.`);
      continue;
    }
    if (pending.some((p) => p.day === day)) {
      warnings.push(`Duplicate drop day ${day}; keeping the first row.`);
      continue;
    }
    const teaserRaw = Math.round(num(r.teaser) ?? 0);
    const explicit = teaserRaw >= 1 ? teaserRaw : undefined;
    if (explicit !== undefined && explicit > teasers.length) {
      warnings.push(
        `Drop day ${day} asks for teaser #${explicit} but only ${teasers.length} teaser(s) are set; rendering as text.`,
      );
    }
    pending.push({
      day,
      title: str(r.title).trim(),
      rowIndex,
      ...(explicit !== undefined && explicit <= teasers.length
        ? { explicitTeaser: explicit - 1 }
        : {}),
    });
  }
  // Teaser assignment: explicit slots first, then unclaimed teasers fill the
  // remaining drop days in ascending day order.
  pending.sort((a, b) => a.day - b.day);
  const claimed = new Set<number>(
    pending
      .map((p) => p.explicitTeaser)
      .filter((i): i is number => i !== undefined),
  );
  let autoCursor = 0;
  for (const p of pending) {
    let teaserIndex = p.explicitTeaser;
    if (teaserIndex === undefined) {
      while (autoCursor < teasers.length && claimed.has(autoCursor)) autoCursor++;
      if (autoCursor < teasers.length) {
        teaserIndex = autoCursor;
        claimed.add(autoCursor);
        autoCursor++;
      }
    }
    dropsByDay.set(p.day, {
      day: p.day,
      title: p.title,
      rowIndex: p.rowIndex,
      ...(teaserIndex !== undefined ? { teaserIndex } : {}),
    });
  }

  // ── Branded weekdays (one optional label per weekday; empty = plain) ──
  const weekdayGroup = (props.weekdays ?? {}) as Record<string, unknown>;
  const specialLabelByWeekday: (string | undefined)[] = WEEKDAY_KEYS.map((key) => {
    const label = str(weekdayGroup[key]).trim();
    return label === "" ? undefined : label;
  });

  // ── Cues ──
  const holdSec = clamp(num(props.holdSec) ?? 4, 0.5, 30);
  const rawCues = Array.isArray(props.cues) ? props.cues.slice(0, MAX_CUES) : [];
  type TimedCue = { day: number; startMs: number; endMs?: number };
  const timed: TimedCue[] = [];
  for (const row of rawCues) {
    if (typeof row !== "object" || row === null) continue;
    const r = row as Record<string, unknown>;
    const startMs = num(r.startMs);
    if (startMs === undefined) continue; // untimed — the studio exists to fix these
    const day = parseCueDay(r.text, monthDayCount);
    if (day === undefined) {
      warnings.push(
        `Cue ${JSON.stringify(str(r.text))} names no valid day of ${year}-${month}; skipped.`,
      );
      continue;
    }
    const endMs = num(r.endMs);
    // Cue times are stamped against the FULL facecam in the cue studio, so
    // they are SOURCE times. With picked clips the render only shows part of
    // that footage — carry each window onto the cut, and drop cues whose
    // moment was cut out (there is no frame left to highlight).
    const rawStart = Math.max(0, Math.round(startMs));
    const rawEnd = endMs !== undefined && endMs > startMs ? Math.round(endMs) : undefined;
    const window = reel
      ? mapFacecamWindow(reel, rawStart, rawEnd)
      : { startMs: rawStart, ...(rawEnd !== undefined ? { endMs: rawEnd } : {}) };
    if (window === undefined) {
      warnings.push(
        `Cue for day ${day} falls outside the picked facecam clips; skipped.`,
      );
      continue;
    }
    timed.push({
      day,
      startMs: window.startMs,
      ...(window.endMs !== undefined ? { endMs: window.endMs } : {}),
    });
  }
  timed.sort((a, b) => a.startMs - b.startMs);
  const cues: ResolvedCue[] = [];
  for (let i = 0; i < timed.length; i++) {
    const c = timed[i];
    const startSec = c.startMs / 1000;
    if (startSec >= durationSec) {
      warnings.push(`Cue for day ${c.day} starts past the render end; skipped.`);
      continue;
    }
    const nextStart = i + 1 < timed.length ? timed[i + 1].startMs / 1000 : undefined;
    const endSec = Math.min(
      durationSec,
      c.endMs !== undefined ? c.endMs / 1000 : (nextStart ?? startSec + holdSec),
    );
    if (endSec <= startSec) continue;
    cues.push({ day: c.day, startSec, endSec });
  }

  // ── Facecam area (drawn rect escape hatch) ──
  // A bad value must not kill the render: it warns and falls back to the
  // automatic placement. Only the FIRST rect counts (the picker caps at one).
  let facecamRegion: ResolvedConfig["facecamRegion"];
  if (props.facecamRegion !== undefined && props.facecamRegion !== null && props.facecamRegion !== "") {
    const parsed = parseRegionsValue(props.facecamRegion);
    if (!parsed.ok) {
      warnings.push(`facecamRegion ignored: ${parsed.error}`);
    } else if (parsed.regions.length > 0) {
      facecamRegion = {
        ...(parsed.canvas ? { canvas: parsed.canvas } : {}),
        regions: [parsed.regions[0]],
      };
    }
  }

  // ── Theme / look ──
  const themeName = isCalendarThemeName(props.theme) ? props.theme : "studio";
  const theme = resolveCalendarTheme(themeName, {
    accent: str(props.accentColor),
    surface: str(props.backgroundColor),
  });
  const fontFamily = str(props.fontFamily).trim() || "Roboto";
  const look = props.look ?? {};
  const spot = props.spotlight ?? {};

  return {
    ok: true,
    warnings,
    cfg: {
      year,
      month,
      weekStart,
      grid,
      monthDayCount,
      dropsByDay,
      dayRowCount: rawDays.length,
      teasers,
      specialLabelByWeekday,
      facecam: str(props.facecam).trim(),
      facecamSlot: props.facecamSlot === true,
      facecamCorner: (["top-left", "top-right", "bottom-left", "bottom-right"] as const).includes(
        props.facecamCorner as never,
      )
        ? (props.facecamCorner as "top-left" | "top-right" | "bottom-left" | "bottom-right")
        : "top-left",
      facecamSize: clamp(num(props.facecamSize) ?? 0.34, 0.2, 0.5),
      facecamStrokePx: clamp(Math.round(num(props.facecamStrokePx) ?? 2), 0, 24),
      facecamStrokeColor: str(props.facecamStrokeColor).trim(),
      ...(facecamRegion !== undefined ? { facecamRegion } : {}),
      safeArea: props.safeArea !== false,
      showChrome: props.showChrome === true,
      ...(reel !== undefined ? { facecamReel: reel } : {}),
      facecamAudio: props.facecamAudio !== false,
      muteTeasers: props.muteTeasers !== false,
      cues,
      holdSec,
      spotlight: {
        enabled: spot.enabled !== false,
        sizeFrac: clamp(num(spot.sizeFrac) ?? 0.62, 0.3, 0.95),
        dim: spot.dim !== false,
        delaySec: clamp(num(spot.delaySec) ?? 1, 0, 10),
      },
      theme,
      platform: resolveCreatorPlatform(props.platform),
      fontFamily,
      cellMediaFit: look.cellMediaFit === "contain" ? "contain" : "cover",
      showTitles: look.showTitles !== false,
      showDayNumbers: look.showDayNumbers !== false,
      dimAdjacent: look.dimAdjacent !== false,
    },
  };
}
