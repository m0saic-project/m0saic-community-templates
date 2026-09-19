"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderDvdArtifact = renderDvdArtifact;
const dsl_1 = require("@m0saic/dsl");
const template_utils_1 = require("@m0saic/template-utils");
const contract_1 = require("./contract");
const dieline_1 = require("./dieline");
const validation_1 = require("./validation");
const back_1 = require("./panels/back");
const common_1 = require("./panels/common");
const front_1 = require("./panels/front");
const spine_1 = require("./panels/spine");
function scaleRect(rect, scale) {
    const x = Math.round(rect.x * scale);
    const y = Math.round(rect.y * scale);
    const right = Math.round((rect.x + rect.width) * scale);
    const bottom = Math.round((rect.y + rect.height) * scale);
    return { x, y, w: Math.max(1, right - x), h: Math.max(1, bottom - y) };
}
function globalPanelGeometries(dieline, scale) {
    const canvasW = Math.round(dieline.canvas.width * scale);
    const canvasH = Math.round(dieline.canvas.height * scale);
    const get = (id) => {
        const panel = dieline.panels.find((entry) => entry.id === id);
        if (!panel)
            throw new Error(`missing ${id} panel`);
        const trim = scaleRect(panel.trim, scale);
        let paint;
        if (id === "back")
            paint = { x: 0, y: 0, w: trim.x + trim.w, h: canvasH };
        else if (id === "front")
            paint = { x: trim.x, y: 0, w: canvasW - trim.x, h: canvasH };
        else
            paint = { x: trim.x, y: 0, w: trim.w, h: canvasH };
        return {
            id,
            trim,
            paint,
            safe: scaleRect(panel.safe, scale),
            widthMm: panel.widthMm,
            heightMm: dieline.spec.heightMm,
            dpi: dieline.dpi * scale,
        };
    };
    return { back: get("back"), spine: get("spine"), front: get("front") };
}
function localPanelGeometry(dieline, id) {
    const panel = dieline.panels.find((entry) => entry.id === id);
    if (!panel)
        throw new Error(`missing ${id} panel`);
    // Lattice-friendly canvas for the standalone panel artifact — same snap the
    // full-wrap dieline gets (a bare 130mm @300DPI lands on 1535 = 5·307, which
    // has no usable divisor pitch and would emit unit columns).
    const tolerancePx = (0, dieline_1.dvdLatticeSnapTolerancePx)(dieline.dpi);
    const w = (0, template_utils_1.snapPxToLatticeFriendly)((0, template_utils_1.mmToPx)(panel.widthMm, dieline.dpi), { tolerancePx });
    const h = (0, template_utils_1.snapPxToLatticeFriendly)((0, template_utils_1.mmToPx)(dieline.spec.heightMm, dieline.dpi), { tolerancePx });
    const panelSpec = dieline.spec.panels.find((entry) => entry.id === id);
    const safeInset = (0, template_utils_1.mmToPx)(panelSpec?.safeMarginMm ?? dieline.spec.safeMarginMm, dieline.dpi);
    return {
        id,
        trim: { x: 0, y: 0, w, h },
        paint: { x: 0, y: 0, w, h },
        safe: { x: safeInset, y: safeInset, w: w - safeInset * 2, h: h - safeInset * 2 },
        widthMm: panel.widthMm,
        heightMm: dieline.spec.heightMm,
        dpi: dieline.dpi,
    };
}
function guideRectPieces(rect, color, label, thickness) {
    const t = Math.max(1, thickness);
    return [
        (0, common_1.solidPiece)({ x: rect.x, y: rect.y, w: rect.w, h: t }, color, `${label} top`, 20),
        (0, common_1.solidPiece)({ x: rect.x, y: rect.y + rect.h - t, w: rect.w, h: t }, color, `${label} bottom`, 20),
        (0, common_1.solidPiece)({ x: rect.x, y: rect.y, w: t, h: rect.h }, color, `${label} left`, 20),
        (0, common_1.solidPiece)({ x: rect.x + rect.w - t, y: rect.y, w: t, h: rect.h }, color, `${label} right`, 20),
    ];
}
function dielineGuidePieces(dieline, scale) {
    const thickness = Math.max(1, Math.round(scale * 2));
    const trim = scaleRect(dieline.trimBox, scale);
    const pieces = guideRectPieces(trim, "#00ffff@0.8", "trim guide", thickness);
    dieline.panels.forEach((panel) => pieces.push(...guideRectPieces(scaleRect(panel.safe, scale), "#00ff88@0.7", `${panel.id} safe guide`, thickness)));
    dieline.foldLinesX.forEach((x, index) => pieces.push((0, common_1.solidPiece)({ x: Math.round(x * scale), y: 0, w: thickness, h: Math.round(dieline.canvas.height * scale) }, "#ff3bd4@0.8", `fold guide ${index + 1}`, 21)));
    return pieces;
}
function proofBandPieces(args) {
    const { rect, props, variant, validation, dieline, barcode } = args;
    const errorCount = validation.diagnostics.filter((item) => item.severity === "error").length;
    const warnCount = validation.diagnostics.filter((item) => item.severity === "warn").length;
    const lines = [
        `${variant.skuLabel} | ${variant.profile.label} | ${variant.catalogNumber}`,
        // dieline.dpi, not props.dpi: a device/CLI canvas override scales the
        // render via the effective dpi — the proof must state what was printed.
        `${dieline.canvasWidthMm} x ${dieline.canvasHeightMm} mm | ${dieline.canvas.width} x ${dieline.canvas.height} px | ${Math.round(dieline.dpi)} DPI | RGB PNG`,
        `${variant.profile.barcodeSymbology.toUpperCase()} ${validation.normalizedBarcode} | module ${barcode.moduleWidthPx}px | ${barcode.achievedMagnificationPct.toFixed(1)}% magnification`,
        `${errorCount} errors | ${warnCount} warnings | placeholder badges ${props.usePlaceholderBadges ? "enabled" : "disabled"}`,
    ];
    const rowH = Math.max(1, Math.floor(rect.h / lines.length));
    const pieces = [(0, common_1.solidPiece)(rect, "#f4f4f1", "proof metadata band", 0)];
    lines.forEach((line, index) => pieces.push({
        rect: { x: rect.x + Math.round(rect.w * 0.02), y: rect.y + index * rowH, w: Math.round(rect.w * 0.96), h: index === lines.length - 1 ? rect.h - index * rowH : rowH, importance: 2 },
        source: (0, common_1.textSource)({ text: line, fontSize: Math.max(8, rowH * 0.3), color: "#17191d", label: `proof metadata ${index + 1}`, hAlign: "left" }),
    }));
    return pieces;
}
function buildPiecesForPanels(args) {
    const pieces = [];
    const piecesByPanel = {
        back: [],
        spine: [],
        front: [],
    };
    const childrenByPanel = {
        back: {},
        spine: {},
        front: {},
    };
    let barcode;
    for (const id of args.panelIds) {
        let panelPieces;
        if (id === "back") {
            const built = (0, back_1.buildBackPanel)({
                ...args,
                geometry: args.geometries.back,
                children: childrenByPanel.back,
            });
            panelPieces = built.pieces;
            barcode = built.barcode;
        }
        else if (id === "spine") {
            const built = (0, spine_1.buildSpinePanel)({ ...args, geometry: args.geometries.spine });
            panelPieces = built.pieces;
            childrenByPanel.spine = built.children;
        }
        else {
            panelPieces = (0, front_1.buildFrontPanel)({ ...args, geometry: args.geometries.front });
        }
        piecesByPanel[id] = panelPieces;
        pieces.push(...panelPieces);
    }
    return { pieces, piecesByPanel, childrenByPanel, ...(barcode ? { barcode } : {}) };
}
function groupPiecesAsChild(args) {
    const normalized = args.pieces.map((piece) => ({
        ...piece,
        rect: {
            ...piece.rect,
            x: piece.rect.x - args.bounds.x,
            y: piece.rect.y - args.bounds.y,
        },
    }));
    const placed = (0, template_utils_1.placeInsetPieces)({
        rootW: args.bounds.w,
        rootH: args.bounds.h,
        pieces: normalized,
    });
    if (!(0, dsl_1.isValidM0String)(String(placed.m0))) {
        throw new Error(`DVD ${args.label}: generated invalid child m0`);
    }
    args.children[args.key] = {
        kind: "mosaic_document",
        version: 1,
        m0: placed.m0,
        sources: placed.sources,
        assets: args.assets,
        ...(args.nestedChildren && Object.keys(args.nestedChildren).length
            ? { children: args.nestedChildren }
            : {}),
        size: { width: args.bounds.w, height: args.bounds.h },
        fps: 30,
        durationMs: 1000,
        backgroundColor: args.backgroundColor ?? "none",
        editor: { label: args.label },
    };
    const source = {
        type: "mosaic",
        ref: args.key,
        placement: { fit: "contain" },
        editor: { owner: "template", label: args.label },
    };
    return {
        rect: { ...args.bounds, importance: args.importance ?? 1 },
        source,
    };
}
function renderDvdArtifact(args) {
    const { artifact, props, variant, validation, dieline, ctx } = args;
    const assets = (0, common_1.createDvdAssetRegistry)();
    const children = {};
    let canvasW;
    let canvasH;
    let pieces;
    let backSafe;
    let barcode;
    if (artifact === "front" || artifact === "spine" || artifact === "back") {
        const geometry = localPanelGeometry(dieline, artifact);
        canvasW = geometry.trim.w;
        canvasH = geometry.trim.h;
        const geometries = { back: geometry, spine: geometry, front: geometry };
        const built = buildPiecesForPanels({ panelIds: [artifact], geometries, props, variant, validation, assets });
        pieces = [groupPiecesAsChild({
                key: `panel-${artifact}`,
                label: `${artifact} panel`,
                bounds: geometry.paint,
                pieces: built.piecesByPanel[artifact],
                children,
                nestedChildren: built.childrenByPanel[artifact],
                assets: assets.manifest,
                backgroundColor: "#10141d",
            })];
        barcode = built.barcode;
        if (artifact === "back")
            backSafe = geometry.safe;
    }
    else {
        const scale = artifact === "preview" ? 900 / dieline.canvas.width : 1;
        const geometries = globalPanelGeometries(dieline, scale);
        canvasW = Math.round(dieline.canvas.width * scale);
        const wrapH = Math.round(dieline.canvas.height * scale);
        const proofBandH = artifact === "proof" ? (0, template_utils_1.mmToPx)(16, dieline.dpi) : 0;
        canvasH = wrapH + proofBandH;
        const built = buildPiecesForPanels({ panelIds: ["back", "spine", "front"], geometries, props, variant, validation, assets });
        pieces = ["back", "spine", "front"].map((id) => groupPiecesAsChild({
            key: `panel-${id}`,
            label: `${id} panel`,
            bounds: geometries[id].paint,
            pieces: built.piecesByPanel[id],
            children,
            nestedChildren: built.childrenByPanel[id],
            assets: assets.manifest,
            backgroundColor: "#10141d",
        }));
        barcode = built.barcode;
        backSafe = geometries.back.safe;
        if (props.dielineOverlay || artifact === "proof") {
            pieces.push(groupPiecesAsChild({
                key: "dieline-guides",
                label: "dieline guides",
                bounds: { x: 0, y: 0, w: canvasW, h: wrapH },
                pieces: dielineGuidePieces(dieline, scale),
                children,
                assets: assets.manifest,
                importance: 20,
            }));
        }
        if (artifact === "proof") {
            const proofBarcode = barcode ?? (0, back_1.buildPackagingBarcode)(variant, validation.normalizedBarcode, dieline.dpi);
            const proofRect = { x: 0, y: wrapH, w: canvasW, h: proofBandH };
            pieces.push(groupPiecesAsChild({
                key: "proof-metadata",
                label: "proof metadata",
                bounds: proofRect,
                pieces: proofBandPieces({ rect: proofRect, props, variant, validation, dieline, barcode: proofBarcode }),
                children,
                assets: assets.manifest,
                backgroundColor: "#f4f4f1",
                importance: 20,
            }));
        }
    }
    barcode ??= (0, back_1.buildPackagingBarcode)(variant, validation.normalizedBarcode, dieline.dpi);
    const placed = (0, template_utils_1.placeInsetPieces)({ rootW: canvasW, rootH: canvasH, pieces });
    if (!(0, dsl_1.isValidM0String)(String(placed.m0))) {
        throw new Error(`DVD ${artifact}: generated invalid m0`);
    }
    let doc = {
        kind: "mosaic_document",
        version: 1,
        m0: placed.m0,
        sources: placed.sources,
        assets: assets.manifest,
        ...(Object.keys(children).length ? { children } : {}),
        size: { width: canvasW, height: canvasH },
        fps: 30,
        durationMs: 1000,
        format: { kind: "image", container: "png", pixelFormat: "rgba" },
        backgroundColor: "#10141d",
        editor: { label: `${variant.skuLabel} ${artifact}` },
    };
    const constraints = (0, contract_1.dvdLayoutConstraints)({ artifact, props, canvasW, canvasH, ...(backSafe ? { backSafe } : {}) });
    const layout = (0, contract_1.checkDvdLayout)(doc, constraints);
    const sidecar = (0, validation_1.buildPackagingSidecar)({
        artifact, props, variant, dieline, validation,
        moduleWidthPx: barcode.moduleWidthPx,
        achievedMagnificationPct: barcode.achievedMagnificationPct,
        layout: layout.violations,
    });
    doc = { ...doc, sidecars: { packaging: sidecar } };
    doc = (0, contract_1.applyDvdLayoutContract)(doc, ctx, constraints, props.debugLayout ?? false);
    return { doc, sidecar, layoutViolations: layout.violations };
}
