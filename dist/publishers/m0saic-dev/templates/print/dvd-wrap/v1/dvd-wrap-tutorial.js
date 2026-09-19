"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderDvdWrapTutorial = renderDvdWrapTutorial;
const dsl_1 = require("@m0saic/dsl");
const template_utils_1 = require("@m0saic/template-utils");
const common_1 = require("./panels/common");
const PAGES = [
    { name: "anatomy", durationMs: 5000, eyebrow: "PAGE 1 OF 5", title: "One sheet, three panels", body: "The print master is back + spine + front inside one bleed box. The case and disc count resolve the spine before anything is placed.", diagram: "anatomy" },
    { name: "inputs", durationMs: 5000, eyebrow: "PAGE 2 OF 5", title: "Creative stays creative", body: "Supply approved art and copy. Structured props own barcodes, catalog data, technical specs, distributor copy, legal clauses, and badge joins.", diagram: "inputs" },
    { name: "territories", durationMs: 5000, eyebrow: "PAGE 3 OF 5", title: "Variants are the multiplier", body: "Add territory variants once. One render fans out the selected artifacts while isolating a bad SKU from every good SKU.", diagram: "territories" },
    { name: "artifacts", durationMs: 5000, eyebrow: "PAGE 4 OF 5", title: "Masters, panels, proofs", body: "Choose wrap, front, spine, back, proof, or preview. Every deliverable carries a packaging sidecar with dieline, barcode, DPI, and validation facts.", diagram: "artifacts" },
    { name: "preflight", durationMs: 5000, eyebrow: "PAGE 5 OF 5", title: "Validate before the replicator", body: "Resolve rating artwork, verify check digits, review effective DPI, inspect overflow warnings, and replace every neutral placeholder before release.", diagram: "preflight" },
];
function labeledBox(rect, fill, text, label, H) {
    return [
        (0, common_1.solidPiece)(rect, fill, `${label} box`, 1),
        { rect: { ...rect, importance: 2 }, source: (0, common_1.textSource)({ text, fontSize: Math.max(7, H * 0.017), color: "#ffffff", label, hAlign: "center" }) },
    ];
}
function diagramPieces(kind, rect, H) {
    const pieces = [];
    if (kind === "anatomy") {
        pieces.push(...labeledBox((0, common_1.sliceRect)(rect, 0, 0.08, 0.46, 0.84), "#23324a", "BACK", "tutorial back", H));
        pieces.push(...labeledBox((0, common_1.sliceRect)(rect, 0.46, 0.08, 0.08, 0.84), "#c6531a", "SPINE", "tutorial spine", H));
        pieces.push(...labeledBox((0, common_1.sliceRect)(rect, 0.54, 0.08, 0.46, 0.84), "#314f78", "FRONT", "tutorial front", H));
    }
    else if (kind === "inputs") {
        ["KEY ART", "COPY", "BARCODE", "BADGES", "SPECS", "LEGAL"].forEach((label, index) => {
            pieces.push(...labeledBox((0, common_1.sliceRect)(rect, (index % 3) / 3, Math.floor(index / 3) / 2, 0.3, 0.44), index < 2 ? "#314f78" : "#1b2432", label, `tutorial input ${index + 1}`, H));
        });
    }
    else if (kind === "territories") {
        ["US", "CA", "UK", "DE", "FR", "AU", "JP"].forEach((label, index) => {
            pieces.push(...labeledBox((0, common_1.sliceRect)(rect, index / 7, 0.22, 0.12, 0.56), index % 2 ? "#23324a" : "#314f78", label, `tutorial territory ${label}`, H));
        });
    }
    else if (kind === "artifacts") {
        ["WRAP", "FRONT", "SPINE", "BACK", "PROOF", "PREVIEW"].forEach((label, index) => {
            pieces.push(...labeledBox((0, common_1.sliceRect)(rect, (index % 3) / 3, Math.floor(index / 3) / 2, 0.3, 0.44), index === 0 ? "#c6531a" : "#23324a", label, `tutorial artifact ${label}`, H));
        });
    }
    else {
        ["CHECK DIGIT", "RATING ART", "300 DPI", "TEXT FIT", "NO PLACEHOLDERS"].forEach((label, index) => {
            const y = index / 5;
            const box = (0, common_1.sliceRect)(rect, 0.08, y, 0.84, 0.16);
            pieces.push((0, common_1.solidPiece)(box, index === 4 ? "#315f4c" : "#1b2432", `tutorial check ${index + 1} box`, 1));
            pieces.push({ rect: { ...box, importance: 2 }, source: (0, common_1.textSource)({ text: `OK  ${label}`, fontSize: Math.max(7, H * 0.016), color: "#ffffff", label: `tutorial check ${index + 1}`, hAlign: "left" }) });
        });
    }
    return pieces;
}
function renderPage(page, ctx) {
    // Lattice-friendly canvas — same rationale as the cover: raw stage dims can
    // be prime (3307×2244 here) and each tutorial page would emit hostile unit
    // lattices. Screen-only surface; the stage letterboxes the ±3px away.
    const W = (0, template_utils_1.snapPxToLatticeFriendly)(Math.max(320, Math.round(ctx.target.width)));
    const H = (0, template_utils_1.snapPxToLatticeFriendly)(Math.max(240, Math.round(ctx.target.height)));
    const pad = Math.max(12, Math.round(Math.min(W, H) * 0.05));
    const stage = { x: pad, y: pad, w: W - pad * 2, h: H - pad * 2 };
    const pieces = [(0, common_1.solidPiece)({ x: 0, y: 0, w: W, h: H }, "#080b12", "tutorial surface")];
    pieces.push({ rect: { ...(0, common_1.sliceRect)(stage, 0, 0, 0.42, 0.08), importance: 2 }, source: (0, common_1.textSource)({ text: page.eyebrow, fontSize: Math.max(7, H * 0.014), color: "#f08a43", label: "tutorial eyebrow", hAlign: "left" }) });
    pieces.push(...(0, common_1.textBlockPieces)({ text: page.title, rect: (0, common_1.sliceRect)(stage, 0, 0.11, 0.42, 0.2), fontSize: Math.max(14, H * 0.04), color: "#ffffff", label: "tutorial page title", maxLines: 3, importance: 2 }));
    pieces.push(...(0, common_1.textBlockPieces)({ text: page.body, rect: (0, common_1.sliceRect)(stage, 0, 0.34, 0.42, 0.45), fontSize: Math.max(9, H * 0.022), color: "#c8ced8", label: "tutorial page body", maxLines: 8, importance: 2 }));
    pieces.push(...diagramPieces(page.diagram, (0, common_1.sliceRect)(stage, 0.48, 0.1, 0.52, 0.76), H));
    pieces.push({ rect: { ...(0, common_1.sliceRect)(stage, 0, 0.91, 1, 0.07), importance: 2 }, source: (0, common_1.textSource)({ text: "Seeded profiles are starting points, not legal advice.", fontSize: Math.max(7, H * 0.014), color: "#8f99a8", label: "tutorial disclaimer", hAlign: "center" }) });
    const placed = (0, template_utils_1.placeInsetPieces)({ rootW: W, rootH: H, pieces });
    if (!(0, dsl_1.isValidM0String)(String(placed.m0)))
        throw new Error(`DVD tutorial page ${page.name} generated invalid m0`);
    return { kind: "mosaic_document", version: 1, m0: placed.m0, sources: placed.sources, assets: {}, size: { width: W, height: H }, fps: 30, durationMs: page.durationMs, backgroundColor: "#080b12", editor: { label: `DVD tutorial ${page.name}` } };
}
function renderDvdWrapTutorial(ctx) {
    const steps = PAGES.map((page) => ({ name: page.name, durationMs: page.durationMs, file: renderPage(page, ctx) }));
    return { kind: "mosaic_pipeline", version: 1, steps, durationMs: PAGES.reduce((sum, page) => sum + page.durationMs, 0), fps: 30 };
}
