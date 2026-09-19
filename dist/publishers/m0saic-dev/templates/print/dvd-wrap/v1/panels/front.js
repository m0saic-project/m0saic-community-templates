"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildFrontPanel = buildFrontPanel;
const common_1 = require("./common");
function frontRatingPieces(args) {
    const placement = args.variant.profile.ratingPlacements.find((item) => item.panelId === "front");
    if (!placement)
        return [];
    if (!args.validation.ratingBadgeArt && !args.props.usePlaceholderBadges)
        return [];
    const size = Math.max(16, Math.min(Math.round(placement.minSizeMm * (0, common_1.pxPerMm)(args.geometry.dpi)), Math.round(Math.min(args.geometry.trim.w, args.geometry.trim.h) * 0.3)));
    const rect = (0, common_1.cornerRect)(args.geometry.trim, placement.corner, size, Math.max(2, Math.round(2 * (0, common_1.pxPerMm)(args.geometry.dpi))));
    if (args.validation.ratingBadgeArt) {
        return [(0, common_1.mediaPiece)(rect, args.assets.media(args.validation.ratingBadgeArt, "front rating badge"), 4)];
    }
    return [
        (0, common_1.solidPiece)(rect, "#20242c", "front rating placeholder", 4),
        {
            rect: { ...rect, importance: 5 },
            source: (0, common_1.textSource)({
                text: args.variant.ratingCertification || args.variant.profile.ratingSystem,
                fontSize: Math.max(7, size * 0.16),
                color: "#ffffff",
                label: "front rating placeholder text",
                hAlign: "center",
            }),
        },
    ];
}
function buildFrontPanel(args) {
    const { props, variant, geometry, assets } = args;
    const ink = "#ffffff";
    const pieces = [];
    if (props.frontArt) {
        pieces.push((0, common_1.mediaPiece)(geometry.paint, assets.media(props.frontArt, "front key art", "cover"), 0));
    }
    else {
        pieces.push((0, common_1.solidPiece)(geometry.paint, "#18263c", "front demo surface", 0));
        pieces.push((0, common_1.solidPiece)((0, common_1.sliceRect)(geometry.paint, 0, 0.55, 1, 0.45), "#0b1018@0.72", "front demo lower wash", 1));
    }
    const titleRect = (0, common_1.sliceRect)(geometry.safe, 0.05, 0.1, 0.9, 0.32);
    if (props.titleTreatmentArt) {
        pieces.push((0, common_1.mediaPiece)(titleRect, assets.media(props.titleTreatmentArt, "front title treatment"), 3));
    }
    else {
        pieces.push(...(0, common_1.textBlockPieces)({
            text: variant.title.toUpperCase(), rect: titleRect,
            fontSize: Math.max(12, geometry.safe.w * 0.075), color: ink,
            label: "front title", maxLines: 3, hAlign: "center", importance: 3,
        }));
    }
    if (variant.editionFlash.trim()) {
        const flash = (0, common_1.sliceRect)(geometry.safe, 0.5, 0.01, 0.48, 0.08);
        pieces.push((0, common_1.solidPiece)(flash, "#c24f18", "edition flash background", 3));
        pieces.push({ rect: { ...flash, importance: 4 }, source: (0, common_1.textSource)({ text: variant.editionFlash.toUpperCase(), fontSize: Math.max(7, flash.h * 0.34), color: "#ffffff", label: "edition flash", hAlign: "center" }) });
    }
    const laurels = (props.laurelArts ?? []).slice(0, 4);
    laurels.forEach((path, index) => {
        const width = geometry.safe.w / Math.max(2, laurels.length);
        const rect = {
            x: Math.round(geometry.safe.x + index * width),
            y: Math.round(geometry.safe.y + geometry.safe.h * 0.68),
            w: Math.max(1, Math.round(width - (0, common_1.pxPerMm)(geometry.dpi))),
            h: Math.max(1, Math.round(geometry.safe.h * 0.11)),
        };
        pieces.push((0, common_1.mediaPiece)(rect, assets.media(path, `front laurel ${index + 1}`), 3));
    });
    if (props.studioLogoArt) {
        pieces.push((0, common_1.mediaPiece)((0, common_1.sliceRect)(geometry.safe, 0.68, 0.86, 0.3, 0.1), assets.media(props.studioLogoArt, "front studio logo"), 3));
    }
    else if (props.studioName) {
        pieces.push({
            rect: { ...(0, common_1.sliceRect)(geometry.safe, 0.62, 0.88, 0.36, 0.08), importance: 3 },
            source: (0, common_1.textSource)({ text: props.studioName.toUpperCase(), fontSize: Math.max(7, geometry.safe.w * 0.025), color: ink, label: "front studio name", hAlign: "right" }),
        });
    }
    pieces.push(...frontRatingPieces(args));
    return pieces;
}
