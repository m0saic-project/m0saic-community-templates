"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createDvdAssetRegistry = createDvdAssetRegistry;
exports.pxPerMm = pxPerMm;
exports.insetRect = insetRect;
exports.sliceRect = sliceRect;
exports.textSource = textSource;
exports.textBlockPieces = textBlockPieces;
exports.solidPiece = solidPiece;
exports.mediaPiece = mediaPiece;
exports.gridRects = gridRects;
exports.cornerRect = cornerRect;
const template_utils_1 = require("@m0saic/template-utils");
function createDvdAssetRegistry() {
    const manifest = {};
    return {
        manifest,
        media(path, label, fit = "contain") {
            const assetId = (0, template_utils_1.uniqueAssetKey)((0, template_utils_1.slugifyAssetKeyFromPath)(path), manifest);
            manifest[assetId] = { kind: "file", path, mediaType: "image", displayName: label };
            return {
                type: "media",
                mediaType: "image",
                assetId,
                placement: { fit },
                editor: { owner: "template", label },
            };
        },
    };
}
function pxPerMm(dpi) {
    return dpi / 25.4;
}
function insetRect(rect, inset) {
    return {
        x: rect.x + inset,
        y: rect.y + inset,
        w: Math.max(1, rect.w - inset * 2),
        h: Math.max(1, rect.h - inset * 2),
    };
}
function sliceRect(rect, xFrac, yFrac, wFrac, hFrac) {
    const x = Math.round(rect.x + rect.w * xFrac);
    const y = Math.round(rect.y + rect.h * yFrac);
    const right = Math.round(rect.x + rect.w * (xFrac + wFrac));
    const bottom = Math.round(rect.y + rect.h * (yFrac + hFrac));
    return { x, y, w: Math.max(1, right - x), h: Math.max(1, bottom - y) };
}
function textSource(args) {
    return {
        type: "text",
        rasterizer: "svg",
        style: { fontSize: Math.max(6, Math.round(args.fontSize)), fontColor: args.color },
        layers: [{ content: { kind: "literal", text: args.text } }],
        placement: { hAlign: args.hAlign ?? "left", vAlign: "middle" },
        ...(args.backgroundColor ? { visual: { backgroundColor: args.backgroundColor } } : {}),
        renderMode: { kind: "image" },
        editor: { owner: "template", label: args.label },
    };
}
function textBlockPieces(args) {
    const maxChars = Math.max(4, Math.floor(args.rect.w / Math.max(1, args.fontSize * 0.56)));
    const rawLines = (0, template_utils_1.wrapText)(args.text.trim() || " ", maxChars);
    const lines = rawLines.slice(0, args.maxLines);
    if (rawLines.length > args.maxLines && lines.length) {
        const last = lines.length - 1;
        lines[last] = `${lines[last].slice(0, Math.max(1, maxChars - 3)).trimEnd()}...`;
    }
    const lineH = Math.max(1, Math.floor(args.rect.h / Math.max(1, lines.length)));
    return lines.map((line, index) => ({
        rect: {
            x: args.rect.x,
            y: args.rect.y + index * lineH,
            w: args.rect.w,
            h: index === lines.length - 1 ? args.rect.h - index * lineH : lineH,
            importance: args.importance ?? 2,
        },
        source: textSource({
            text: line,
            fontSize: args.fontSize,
            color: args.color,
            // Every wrapped line keeps the semantic block label. Layout contracts
            // intentionally target intent, not a line number that changes when copy
            // reflows at another DPI or panel width.
            label: args.label,
            hAlign: args.hAlign,
        }),
    }));
}
function solidPiece(rect, color, label, importance = 0) {
    const source = (0, template_utils_1.makeColorTile)(color);
    source.editor = { owner: "template", label };
    return { rect: { ...rect, importance }, source };
}
function mediaPiece(rect, source, importance = 1) {
    return { rect: { ...rect, importance }, source };
}
function gridRects(rect, count, gapPx) {
    if (count <= 0)
        return [];
    const cols = count === 1 ? 1 : count <= 4 ? 2 : 3;
    const rows = Math.ceil(count / cols);
    const out = [];
    for (let index = 0; index < count; index++) {
        const row = Math.floor(index / cols);
        const col = index % cols;
        const x0 = Math.round(rect.x + (col * rect.w) / cols + (col === 0 ? 0 : gapPx / 2));
        const x1 = Math.round(rect.x + ((col + 1) * rect.w) / cols - (col === cols - 1 ? 0 : gapPx / 2));
        const y0 = Math.round(rect.y + (row * rect.h) / rows + (row === 0 ? 0 : gapPx / 2));
        const y1 = Math.round(rect.y + ((row + 1) * rect.h) / rows - (row === rows - 1 ? 0 : gapPx / 2));
        out.push({ x: x0, y: y0, w: Math.max(1, x1 - x0), h: Math.max(1, y1 - y0) });
    }
    return out;
}
function cornerRect(bounds, corner, size, pad) {
    const left = corner.endsWith("left");
    const top = corner.startsWith("top");
    return {
        x: left ? bounds.x + pad : bounds.x + bounds.w - size - pad,
        y: top ? bounds.y + pad : bounds.y + bounds.h - size - pad,
        w: size,
        h: size,
    };
}
