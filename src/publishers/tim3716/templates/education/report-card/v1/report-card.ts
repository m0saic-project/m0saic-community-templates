import type {
  MosaicColor,
  MosaicDocument,
  MosaicEngineContext,
  MosaicSource,
} from "@m0saic/types";
import { asTemplateId } from "@m0saic/types";
import { toM0String } from "@m0saic/dsl-stdlib";
import {
  bindProps,
  defineMosaicTemplate,
  definePropsSchema,
  makeColorTile,
  placeInsetPieces,
  svgTextSource,
} from "@m0saic/template-utils";

/**
 * `@tim3716/education/report-card/v1` — a mosaic report card: five
 * subject tiles of unevenly weighted sizes (a hero tile plus four small
 * ones) and a sixth accent tile holding the average, computed live from
 * the five grades every render.
 *
 * Every subject name and grade is its own prop, each bound to the exact
 * rect that shows it (`bindProps`, one entry per text layer) so Make's
 * double-click edits it in place. The average and its letter grade are
 * NOT bound — they are derived from the five grades, recomputed on every
 * render, never authored directly.
 */

export type ReportCardProps = {
  /** Headline above the card. */
  title?: string;
  /** Student name line. */
  studentName?: string;
  /** Term / grade-level line. */
  termLabel?: string;
  /** Subject 1 name (hero tile). */
  subject1?: string;
  /** Subject 1 grade, 0-100. */
  grade1?: number;
  /** Subject 2 name. */
  subject2?: string;
  /** Subject 2 grade, 0-100. */
  grade2?: number;
  /** Subject 3 name. */
  subject3?: string;
  /** Subject 3 grade, 0-100. */
  grade3?: number;
  /** Subject 4 name. */
  subject4?: string;
  /** Subject 4 grade, 0-100. */
  grade4?: number;
  /** Subject 5 name. */
  subject5?: string;
  /** Subject 5 grade, 0-100. */
  grade5?: number;
  /** Average tile accent (#rrggbb). */
  accent?: string;
  /** Backdrop (#rrggbb). */
  pageColor?: string;
};

const ID = "@tim3716/education/report-card/v1";
const HEX = /^#[0-9a-fA-F]{6}$/;
const ASCII = /^[\x00-\x7F]*$/;

const INK = "#f3efe8" as MosaicColor;
const DIM = "#aab3ba" as MosaicColor;

const DEFAULTS = {
  title: "Report Card",
  studentName: "Student Name",
  termLabel: "Grade Level - Term",
  subject1: "Mathematics",
  grade1: 92,
  subject2: "Science",
  grade2: 88,
  subject3: "English",
  grade3: 95,
  subject4: "History",
  grade4: 90,
  subject5: "Art",
  grade5: 85,
  accent: "#c9622f",
  pageColor: "#141a21",
} as const;

/** Fixed dark tile fills, one per subject slot - distinct, none the accent. */
const TILE_FILLS = ["#2f4858", "#3c5a45", "#4a3b57", "#5a4632", "#5c3a3a"] as const;

type SubjectSlot = {
  nameKey: keyof ReportCardProps;
  gradeKey: keyof ReportCardProps;
  fill: MosaicColor;
};

const SLOTS: SubjectSlot[] = [1, 2, 3, 4, 5].map((n) => ({
  nameKey: `subject${n}` as keyof ReportCardProps,
  gradeKey: `grade${n}` as keyof ReportCardProps,
  fill: TILE_FILLS[n - 1] as MosaicColor,
}));

function toLetter(n: number): string {
  if (n >= 97) return "A+";
  if (n >= 93) return "A";
  if (n >= 90) return "A-";
  if (n >= 87) return "B+";
  if (n >= 83) return "B";
  if (n >= 80) return "B-";
  if (n >= 77) return "C+";
  if (n >= 73) return "C";
  if (n >= 70) return "C-";
  if (n >= 67) return "D+";
  if (n >= 60) return "D";
  return "F";
}

function textField(
  props: ReportCardProps,
  key: keyof ReportCardProps,
  fallback: string,
  maxLen: number,
): string {
  const raw = props[key];
  const value = typeof raw === "string" ? raw.trim() : fallback;
  if (typeof raw === "string") {
    if (!ASCII.test(raw)) throw new Error(`${ID}: ${String(key)} must be ASCII (the bundled glyph font tofus anything else).`);
    if (raw.length > maxLen) throw new Error(`${ID}: ${String(key)} must be ${maxLen} characters or fewer, got ${raw.length}.`);
  }
  return value;
}

function gradeField(props: ReportCardProps, key: keyof ReportCardProps, fallback: number): number {
  const raw = props[key];
  const value = raw === undefined ? fallback : raw;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 100) {
    throw new Error(`${ID}: ${String(key)} must be a number in [0, 100].`);
  }
  return value;
}

const propsSchema = definePropsSchema<ReportCardProps>({
  title: {
    type: "string",
    required: false,
    description: "Headline above the card.",
    meta: { control: { placeholder: DEFAULTS.title }, ui: { label: "Title", order: 1 } },
  },
  studentName: {
    type: "string",
    required: false,
    description: "Student name line.",
    meta: { control: { placeholder: DEFAULTS.studentName }, ui: { label: "Student name", order: 2 } },
  },
  termLabel: {
    type: "string",
    required: false,
    description: "Term / grade-level line.",
    meta: { control: { placeholder: DEFAULTS.termLabel }, ui: { label: "Term", order: 3 } },
  },
  subject1: { type: "string", required: false, description: "Subject 1 name (hero tile).", meta: { control: { placeholder: DEFAULTS.subject1 }, ui: { label: "Subject 1", order: 10 } } },
  grade1: { type: "number", required: false, description: "Subject 1 grade, 0-100.", meta: { constraints: { min: 0, max: 100 }, control: { step: 1 }, ui: { label: "Grade 1", order: 11 } } },
  subject2: { type: "string", required: false, description: "Subject 2 name.", meta: { control: { placeholder: DEFAULTS.subject2 }, ui: { label: "Subject 2", order: 12 } } },
  grade2: { type: "number", required: false, description: "Subject 2 grade, 0-100.", meta: { constraints: { min: 0, max: 100 }, control: { step: 1 }, ui: { label: "Grade 2", order: 13 } } },
  subject3: { type: "string", required: false, description: "Subject 3 name.", meta: { control: { placeholder: DEFAULTS.subject3 }, ui: { label: "Subject 3", order: 14 } } },
  grade3: { type: "number", required: false, description: "Subject 3 grade, 0-100.", meta: { constraints: { min: 0, max: 100 }, control: { step: 1 }, ui: { label: "Grade 3", order: 15 } } },
  subject4: { type: "string", required: false, description: "Subject 4 name.", meta: { control: { placeholder: DEFAULTS.subject4 }, ui: { label: "Subject 4", order: 16 } } },
  grade4: { type: "number", required: false, description: "Subject 4 grade, 0-100.", meta: { constraints: { min: 0, max: 100 }, control: { step: 1 }, ui: { label: "Grade 4", order: 17 } } },
  subject5: { type: "string", required: false, description: "Subject 5 name.", meta: { control: { placeholder: DEFAULTS.subject5 }, ui: { label: "Subject 5", order: 18 } } },
  grade5: { type: "number", required: false, description: "Subject 5 grade, 0-100.", meta: { constraints: { min: 0, max: 100 }, control: { step: 1 }, ui: { label: "Grade 5", order: 19 } } },
  accent: {
    type: "string",
    required: false,
    description: "Average tile accent as #rrggbb.",
    meta: { constraints: { isColor: true }, control: { colorPicker: true, defaultColor: DEFAULTS.accent }, ui: { label: "Accent", order: 20 } },
  },
  pageColor: {
    type: "string",
    required: false,
    description: "Backdrop as #rrggbb.",
    meta: { constraints: { isColor: true }, control: { colorPicker: true, defaultColor: DEFAULTS.pageColor }, ui: { label: "Page color", order: 21 } },
  },
});

export const ReportCardV1 = defineMosaicTemplate<ReportCardProps>({
  id: asTemplateId(ID),
  label: "Report Card",
  version: 1,
  description:
    "A mosaic report card: five subject tiles at uneven sizes (one hero, four small) plus a sixth accent tile whose average and letter grade are computed live from the five grades on every render, never authored. Every name and grade is bound to the rect that shows it.",
  capabilities: { tier: "core" },
  tags: ["education", "data", "card", "school", "grades"],

  outputHints: {
    width: 1280,
    height: 720,
    fps: 30,
    durationMs: 2000,
    format: { kind: "image", container: "png" },
    note: "Static card - any canvas renders cleanly. The average tile recomputes from the five grades.",
  },

  propsSchema,
  defaultProps: { ...DEFAULTS },

  async render(props: ReportCardProps, ctx: MosaicEngineContext): Promise<MosaicDocument> {
    if (props.pageColor !== undefined && !HEX.test(props.pageColor)) {
      throw new Error(`${ID}: pageColor ${JSON.stringify(props.pageColor)} must be #rrggbb.`);
    }
    if (props.accent !== undefined && !HEX.test(props.accent)) {
      throw new Error(`${ID}: accent ${JSON.stringify(props.accent)} must be #rrggbb.`);
    }
    const page = (props.pageColor ?? DEFAULTS.pageColor) as MosaicColor;
    const accent = (props.accent ?? DEFAULTS.accent) as MosaicColor;

    const title = textField(props, "title", DEFAULTS.title, 40);
    const studentName = textField(props, "studentName", DEFAULTS.studentName, 40);
    const termLabel = textField(props, "termLabel", DEFAULTS.termLabel, 48);

    const subjects = SLOTS.map((slot, i) => ({
      name: textField(props, slot.nameKey, DEFAULTS[`subject${i + 1}` as keyof typeof DEFAULTS] as string, 28),
      grade: gradeField(props, slot.gradeKey, DEFAULTS[`grade${i + 1}` as keyof typeof DEFAULTS] as number),
      fill: slot.fill,
      nameKey: slot.nameKey,
      gradeKey: slot.gradeKey,
    }));

    const average = Math.round((subjects.reduce((sum, s) => sum + s.grade, 0) / subjects.length) * 10) / 10;
    const averageLetter = toLetter(average);

    const { width: W, height: H } = ctx.target;
    const px = (fx: number, fy: number, fw: number, fh: number) => ({
      x: Math.round(fx * W),
      y: Math.round(fy * H),
      w: Math.round(fw * W),
      h: Math.round(fh * H),
    });
    const GUTTER = Math.max(6, Math.round(Math.min(W, H) * 0.018));
    const inset = (r: { x: number; y: number; w: number; h: number }) => ({
      x: r.x + Math.round(GUTTER / 2),
      y: r.y + Math.round(GUTTER / 2),
      w: r.w - GUTTER,
      h: r.h - GUTTER,
    });

    const pieces: Parameters<typeof placeInsetPieces>[0]["pieces"] = [];
    let z = 0;
    const piece = (rect: { x: number; y: number; w: number; h: number }, source: MosaicSource) => {
      pieces.push({ rect: { ...rect, importance: z }, source });
      z += 1;
    };

    // Backdrop.
    piece(px(0, 0, 1, 1), makeColorTile(page));

    // Header: title / student / term, one 3-layer text source, each layer
    // bound to the prop it shows.
    const head = px(0.055, 0.05, 0.89, 0.19);
    piece(
      head,
      bindProps(
        svgTextSource([
          { text: title, fontSize: Math.round(H * 0.06), color: INK, vAlign: "top" },
          { text: studentName, fontSize: Math.round(H * 0.034), color: INK, vAlign: "middle" },
          { text: termLabel, fontSize: Math.round(H * 0.022), color: DIM, vAlign: "bottom" },
        ]),
        [
          { propKey: "title", layer: 0 },
          { propKey: "studentName", layer: 1 },
          { propKey: "termLabel", layer: 2 },
        ],
      ),
    );

    // Mosaic grid: 4 columns x 3 rows. Subject 1 is a hero tile spanning
    // the left half at full height; subjects 2-5 fill a 2x2 block on the
    // right; the average tile is a wide strip under that block.
    const grid = px(0.055, 0.28, 0.89, 0.68);
    const colW = grid.w / 4;
    const rowH = grid.h / 3;
    const cell = (col: number, row: number, colSpan: number, rowSpan: number) =>
      inset({
        x: Math.round(grid.x + col * colW),
        y: Math.round(grid.y + row * rowH),
        w: Math.round(colSpan * colW),
        h: Math.round(rowSpan * rowH),
      });

    const tileRects = [cell(0, 0, 2, 3), cell(2, 0, 1, 1), cell(3, 0, 1, 1), cell(2, 1, 1, 1), cell(3, 1, 1, 1)];

    subjects.forEach((subject, i) => {
      const rect = tileRects[i];
      const isHero = i === 0;
      piece(rect, makeColorTile(subject.fill, { effects: { rounding: { borderRadius: 0.14, cornerStyle: "rounded" } } }));
      piece(
        rect,
        bindProps(
          svgTextSource([
            { text: subject.name, fontSize: Math.round(H * (isHero ? 0.032 : 0.024)), color: DIM, vAlign: "top", padding: { top: isHero ? 0.06 : 0.08 } },
            { text: String(Math.round(subject.grade)), fontSize: Math.round(H * (isHero ? 0.11 : 0.06)), color: INK, vAlign: "middle" },
            { text: toLetter(subject.grade), fontSize: Math.round(H * (isHero ? 0.03 : 0.022)), color: DIM, vAlign: "bottom", padding: { bottom: isHero ? 0.07 : 0.08 } },
          ]),
          [
            { propKey: String(subject.nameKey), layer: 0 },
            { propKey: String(subject.gradeKey), layer: 1, kind: "number" },
          ],
        ),
      );
    });

    // Average tile: wide strip under the 2x2 block. Derived - not bound.
    const avgRect = cell(2, 2, 2, 1);
    piece(avgRect, makeColorTile(accent, { effects: { rounding: { borderRadius: 0.14, cornerStyle: "rounded" } } }));
    piece(
      avgRect,
      svgTextSource([
        { text: "AVERAGE", fontSize: Math.round(H * 0.024), color: INK, vAlign: "top", padding: { top: 0.1 } },
        { text: `${average.toFixed(1)} (${averageLetter})`, fontSize: Math.round(H * 0.06), color: INK, vAlign: "middle" },
      ]),
    );

    const placed = placeInsetPieces({ rootW: W, rootH: H, pieces });
    return {
      kind: "mosaic_document",
      version: 1,
      m0: toM0String(placed.m0, ID),
      assets: {},
      backgroundColor: page,
      sources: placed.sources,
    };
  },
});

export default ReportCardV1;
