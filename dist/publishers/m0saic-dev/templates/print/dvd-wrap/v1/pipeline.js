"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveDvdArtifacts = resolveDvdArtifacts;
exports.buildDvdStepNames = buildDvdStepNames;
exports.renderDvdWrapPipeline = renderDvdWrapPipeline;
const template_utils_1 = require("@m0saic/template-utils");
const rendering_1 = require("./rendering");
const validation_1 = require("./validation");
const variants_1 = require("./variants");
const ARTIFACTS = ["wrap", "front", "spine", "back", "proof", "preview"];
function resolveDvdArtifacts(value) {
    const artifacts = value?.length ? value : ["wrap"];
    const unique = [];
    for (const artifact of artifacts) {
        if (!ARTIFACTS.includes(artifact))
            throw new Error(`unknown DVD artifact ${JSON.stringify(artifact)}`);
        if (!unique.includes(artifact))
            unique.push(artifact);
    }
    if (!unique.length)
        throw new Error("artifacts must select at least one output");
    return unique;
}
function slug(value) {
    const out = value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    return out || "variant";
}
function buildDvdStepNames(variants, artifacts, baseTerritory) {
    const seen = new Map();
    return variants.map((variant) => {
        const territory = slug(variant?.territory ?? baseTerritory);
        const ordinal = (seen.get(territory) ?? 0) + 1;
        seen.set(territory, ordinal);
        const prefix = `${territory}${ordinal === 1 ? "" : ordinal}`;
        return artifacts.map((artifact) => `${prefix}-${artifact}`);
    });
}
function artifactSize(artifact, dieline) {
    if (artifact === "front" || artifact === "back") {
        return { width: (0, template_utils_1.mmToPx)(130, dieline.dpi), height: (0, template_utils_1.mmToPx)(dieline.spec.heightMm, dieline.dpi) };
    }
    if (artifact === "spine") {
        const spine = dieline.panels.find((panel) => panel.id === "spine");
        return { width: (0, template_utils_1.mmToPx)(spine?.widthMm ?? 14, dieline.dpi), height: (0, template_utils_1.mmToPx)(dieline.spec.heightMm, dieline.dpi) };
    }
    if (artifact === "preview") {
        return { width: 900, height: Math.round((dieline.canvas.height / dieline.canvas.width) * 900) };
    }
    return {
        width: dieline.canvas.width,
        height: dieline.canvas.height + (artifact === "proof" ? (0, template_utils_1.mmToPx)(16, dieline.dpi) : 0),
    };
}
function errorStepDocument(args) {
    const size = artifactSize(args.artifact, args.dieline);
    const doc = (0, template_utils_1.makeErrorMosaic)(args.message, {
        title: "DVD Wrap",
        errorCode: "DVD_VARIANT_INVALID",
        width: size.width,
        height: size.height,
    });
    const sidecars = args.effective
        ? {
            packaging: (0, validation_1.buildPackagingSidecar)({
                artifact: args.artifact,
                props: args.props,
                variant: args.effective,
                dieline: args.dieline,
                validation: args.validation ?? (0, validation_1.validateDvdVariant)(args.props, args.effective, args.ctx),
                moduleWidthPx: 0,
                achievedMagnificationPct: 0,
            }),
        }
        : {
            packaging: {
                templateId: "@m0saic-dev/print/dvd-wrap/v1",
                schemaVersion: 1,
                artifact: args.artifact,
                errors: [{ severity: "error", code: "VARIANT_RESOLUTION", message: args.message }],
                warnings: [],
            },
        };
    return {
        ...doc,
        size,
        fps: 30,
        durationMs: 1000,
        format: { kind: "image", container: "png", pixelFormat: "rgba" },
        sidecars,
    };
}
function renderDvdWrapPipeline(props, ctx, dieline) {
    const artifacts = resolveDvdArtifacts(props.artifacts);
    const variants = (0, variants_1.requestedVariants)(props);
    const names = buildDvdStepNames(variants, artifacts, props.territory ?? "US");
    const batchStepCount = variants.length * artifacts.length;
    const steps = [];
    variants.forEach((variant, variantIndex) => {
        let effective;
        let resolutionError;
        try {
            effective = (0, variants_1.resolveEffectiveVariant)(props, variant);
        }
        catch (cause) {
            resolutionError = cause instanceof Error ? cause.message : String(cause);
        }
        let validation = effective ? (0, validation_1.validateDvdVariant)(props, effective, ctx) : undefined;
        if (validation && batchStepCount > 48) {
            validation = {
                ...validation,
                diagnostics: [
                    ...validation.diagnostics,
                    {
                        severity: "warn",
                        code: "BATCH_STEP_COUNT",
                        message: `${batchStepCount} outputs requested; iterate with preview or fewer variants before the production batch`,
                    },
                ],
            };
        }
        const validationErrors = validation?.diagnostics.filter((item) => item.severity === "error") ?? [];
        const errorMessage = resolutionError ?? (validationErrors.length
            ? validationErrors.map((item) => `[${item.code}] ${item.message}`).join("\n")
            : undefined);
        artifacts.forEach((artifact, artifactIndex) => {
            const file = errorMessage || !effective || !validation
                ? errorStepDocument({ message: errorMessage ?? "Variant could not be resolved", artifact, dieline, props, ...(effective ? { effective } : {}), ...(validation ? { validation } : {}), ctx })
                : (0, rendering_1.renderDvdArtifact)({ artifact, props, variant: effective, validation, dieline, ctx }).doc;
            steps.push({
                name: names[variantIndex][artifactIndex],
                label: effective?.skuLabel ?? variant?.skuLabel ?? `${props.title || "dvd"}-${variant?.territory ?? props.territory ?? "US"}`,
                durationMs: 1000,
                file,
            });
        });
    });
    return {
        kind: "mosaic_pipeline",
        version: 1,
        emit: "multi",
        steps,
    };
}
