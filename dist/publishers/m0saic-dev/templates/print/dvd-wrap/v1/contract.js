"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dvdLayoutConstraints = dvdLayoutConstraints;
exports.checkDvdLayout = checkDvdLayout;
exports.applyDvdLayoutContract = applyDvdLayoutContract;
const template_utils_1 = require("@m0saic/template-utils");
function dvdLayoutConstraints(args) {
    const constraints = [];
    if (["wrap", "proof", "preview", "back"].includes(args.artifact)) {
        constraints.push({ label: "back synopsis" });
        if (args.backSafe) {
            constraints.push({
                label: "packaging barcode box",
                minWidthFrac: (args.backSafe.w / args.canvasW) * 0.3,
                minHeightFrac: (args.backSafe.h / args.canvasH) * 0.12,
                within: {
                    xFrac: [args.backSafe.x / args.canvasW, (args.backSafe.x + args.backSafe.w) / args.canvasW],
                    yFrac: [args.backSafe.y / args.canvasH, (args.backSafe.y + args.backSafe.h) / args.canvasH],
                },
            });
        }
        else {
            constraints.push({ label: "packaging barcode box" });
        }
    }
    if (["wrap", "proof", "preview", "front"].includes(args.artifact)) {
        constraints.push({ label: args.props.titleTreatmentArt ? "front title treatment" : "front title" });
    }
    if (["wrap", "proof", "preview", "spine"].includes(args.artifact)) {
        constraints.push({ label: "spine catalog number" });
    }
    return constraints;
}
function checkDvdLayout(doc, constraints) {
    const size = doc.size ?? { width: 1, height: 1 };
    return (0, template_utils_1.checkLayout)(doc, {
        canvasW: size.width,
        canvasH: size.height,
        constraints,
        flatten: true,
    });
}
function applyDvdLayoutContract(doc, ctx, constraints, debug) {
    const size = doc.size ?? { width: ctx.target.width, height: ctx.target.height };
    const localCtx = {
        ...ctx,
        target: { ...ctx.target, width: size.width, height: size.height },
    };
    return (0, template_utils_1.withLayoutContract)(doc, localCtx, {
        templateId: "@m0saic-dev/print/dvd-wrap/v1",
        constraints,
        flatten: true,
        debug,
    });
}
