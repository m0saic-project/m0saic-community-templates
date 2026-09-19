"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseDvdVariants = parseDvdVariants;
exports.resolveEffectiveVariant = resolveEffectiveVariant;
exports.requestedVariants = requestedVariants;
const profiles_1 = require("./profiles");
function objectValue(value, label) {
    if (value == null || value === "")
        return undefined;
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error(`${label} must be an object`);
    }
    return parsed;
}
function parseDvdVariants(value) {
    if (value == null || value === "")
        return [];
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    if (!Array.isArray(parsed))
        throw new Error("variants must be an array");
    return parsed.map((entry, index) => {
        if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
            throw new Error(`variants[${index}] must be an object`);
        }
        const candidate = entry;
        if (typeof candidate.territory !== "string" || !candidate.territory.trim()) {
            throw new Error(`variants[${index}].territory is required`);
        }
        return candidate;
    });
}
function mergeProfile(base, globalOverride, variantOverride) {
    const merged = { ...base, ...(globalOverride ?? {}), ...(variantOverride ?? {}) };
    return {
        ...merged,
        ratingPlacements: variantOverride?.ratingPlacements ?? globalOverride?.ratingPlacements ?? base.ratingPlacements,
        legalClauseTokens: variantOverride?.legalClauseTokens ?? globalOverride?.legalClauseTokens ?? base.legalClauseTokens,
        requiredEcoMarks: variantOverride?.requiredEcoMarks ?? globalOverride?.requiredEcoMarks ?? base.requiredEcoMarks,
        facts: { ...base.facts, ...(globalOverride?.facts ?? {}), ...(variantOverride?.facts ?? {}) },
    };
}
function completeCustomProfile(value) {
    const required = [
        "id", "label", "barcodeSymbology", "regionCode", "videoStandard", "ratingSystem",
        "ratingPlacements", "legalClauseTokens", "spineTextDirection", "bilingual", "requiredEcoMarks", "facts",
    ];
    const missing = required.filter((key) => value?.[key] == null);
    if (missing.length) {
        throw new Error(`territory custom requires a complete profile; missing ${missing.join(", ")}`);
    }
    return value;
}
function slug(value) {
    const normalized = value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    return normalized || "dvd";
}
function resolveEffectiveVariant(props, variant) {
    const territory = (variant?.territory ?? props.territory ?? "US").trim();
    const globalOverride = objectValue(props.profileOverrides, "profileOverrides");
    const profile = territory === "custom"
        ? completeCustomProfile({ ...(globalOverride ?? {}), ...(variant?.profile ?? {}) })
        : (() => {
            const seeded = profiles_1.SEEDED_TERRITORY_PROFILES[territory];
            if (!seeded)
                throw new Error(`unknown territory profile ${JSON.stringify(territory)}`);
            return mergeProfile(seeded, globalOverride, variant?.profile);
        })();
    const title = (variant?.titleOverride ?? props.title ?? "").trim();
    if (!title)
        throw new Error("title is required");
    const skuLabel = (variant?.skuLabel ?? `${slug(title)}-${territory}`).trim();
    return {
        territory,
        skuLabel,
        profile,
        title,
        synopsis: variant?.synopsisOverride ?? props.synopsis ?? "",
        editionFlash: variant?.editionFlashOverride ?? props.editionFlash ?? "",
        barcodeValue: variant?.barcodeValue ?? props.barcodeValue ?? "",
        catalogNumber: variant?.catalogNumber ?? props.catalogNumber ?? "",
        ratingCertification: variant?.ratingCertification ?? props.ratingCertification ?? "",
        distributorName: variant?.distributorName ?? props.distributorName ?? "",
        distributorAddress: variant?.distributorAddress ?? props.distributorAddress ?? "",
        ...(variant?.legalTextOverride ? { legalTextOverride: variant.legalTextOverride } : {}),
        techSpecs: { ...(props.techSpecs ?? {}), ...(variant?.techSpecOverrides ?? {}) },
    };
}
function requestedVariants(props) {
    const variants = parseDvdVariants(props.variants);
    return variants.length ? variants : [undefined];
}
