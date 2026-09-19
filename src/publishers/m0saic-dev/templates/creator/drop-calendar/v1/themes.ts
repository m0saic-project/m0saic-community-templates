/**
 * Drop-calendar theme tokens — template-local design tokens, one set per
 * named theme. `studio` is the default — a dark stage with a charcoal card
 * and the electric-violet accent the rest of the creator pack uses, the look
 * a YouTuber, streamer or musician posts a schedule in. `classic` mirrors the
 * print-calendar reference (warm paper, near-black ink, deep red accent);
 * holiday sets re-skin the same roles so a seasonal calendar is a one-knob
 * change.
 */

export type CalendarThemeName =
  | "studio"
  | "classic"
  | "noir"
  | "valentine"
  | "easter"
  | "halloween"
  | "thanksgiving"
  | "christmas";

export const CALENDAR_THEME_NAMES: CalendarThemeName[] = [
  "studio",
  "classic",
  "noir",
  "valentine",
  "easter",
  "halloween",
  "thanksgiving",
  "christmas",
];

export type CalendarTheme = {
  /** Canvas behind the card (and behind the facecam letterbox). */
  surface: string;
  /** The card sheet the table sits on. */
  paper: string;
  /** Cell fill for adjacent-month (dimmed) days and the header shade. */
  paperMuted: string;
  /** Primary text + table lines. */
  ink: string;
  /** Adjacent-month day numbers, secondary text. */
  inkMuted: string;
  /** Table grid lines (usually = ink). */
  line: string;
  /** Special weekdays, drop titles, highlights. */
  accent: string;
  /** Text placed on accent fills. */
  accentInk: string;
  /** Translucent dark scrim behind text over media. */
  scrim: string;
  /** Thin frame around the facecam — a quiet edge that gives it its own area. */
  frame: string;
};

const THEMES: Record<CalendarThemeName, CalendarTheme> = {
  studio: {
    surface: "#0B0B10",
    paper: "#17171F",
    paperMuted: "#101016",
    ink: "#F2F1F6",
    inkMuted: "#6F6E7C",
    line: "#2E2E3A",
    accent: "#8B5CF6",
    accentInk: "#FFFFFF",
    scrim: "black@0.6",
    frame: "#C4B5FD",
  },
  classic: {
    surface: "#141414",
    paper: "#FAF8F2",
    paperMuted: "#EAE6DB",
    ink: "#1A1A1A",
    inkMuted: "#9B958A",
    line: "#1A1A1A",
    accent: "#A31621",
    accentInk: "#FAF8F2",
    scrim: "black@0.55",
    frame: "#EAE6DB",
  },
  noir: {
    surface: "#060608",
    paper: "#15151B",
    paperMuted: "#0E0E13",
    ink: "#ECEAE4",
    inkMuted: "#6E6C75",
    line: "#34343E",
    accent: "#E0303B",
    accentInk: "#FFFFFF",
    scrim: "black@0.6",
    frame: "#6E6C75",
  },
  valentine: {
    surface: "#2A0A12",
    paper: "#FFF3F5",
    paperMuted: "#F7DEE4",
    ink: "#47101F",
    inkMuted: "#B08A94",
    line: "#47101F",
    accent: "#D6336C",
    accentInk: "#FFF3F5",
    scrim: "black@0.5",
    frame: "#F7DEE4",
  },
  easter: {
    surface: "#DFEBD6",
    paper: "#FDFBF3",
    paperMuted: "#EDEAD9",
    ink: "#3E4A3D",
    inkMuted: "#9AA694",
    line: "#3E4A3D",
    accent: "#7C5FB8",
    accentInk: "#FDFBF3",
    scrim: "black@0.45",
    frame: "#EDEAD9",
  },
  halloween: {
    surface: "#0B0B0F",
    paper: "#191322",
    paperMuted: "#110D18",
    ink: "#F4EDE1",
    inkMuted: "#776E88",
    line: "#3D2E52",
    accent: "#F26419",
    accentInk: "#14100A",
    scrim: "black@0.6",
    frame: "#776E88",
  },
  thanksgiving: {
    surface: "#2E1B0E",
    paper: "#F8EFDD",
    paperMuted: "#EBDFC5",
    ink: "#4A2C17",
    inkMuted: "#A8916F",
    line: "#4A2C17",
    accent: "#C05621",
    accentInk: "#F8EFDD",
    scrim: "black@0.5",
    frame: "#EBDFC5",
  },
  christmas: {
    surface: "#0D2417",
    paper: "#F6F3EA",
    paperMuted: "#E5E0D0",
    ink: "#14331F",
    inkMuted: "#8FA093",
    line: "#14331F",
    accent: "#B3202C",
    accentInk: "#F6F3EA",
    scrim: "black@0.5",
    frame: "#E5E0D0",
  },
};

export function isCalendarThemeName(v: unknown): v is CalendarThemeName {
  return typeof v === "string" && (CALENDAR_THEME_NAMES as string[]).includes(v);
}

/**
 * Resolve theme tokens: named theme, with optional per-role overrides (empty
 * strings mean "keep the theme's value").
 */
export function resolveCalendarTheme(
  name: CalendarThemeName,
  overrides?: { accent?: string; surface?: string },
): CalendarTheme {
  const base = THEMES[name];
  const accent = overrides?.accent?.trim();
  const surface = overrides?.surface?.trim();
  if (!accent && !surface) return base;
  return {
    ...base,
    ...(accent ? { accent } : {}),
    ...(surface ? { surface } : {}),
  };
}
