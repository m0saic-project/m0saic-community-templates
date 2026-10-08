// Export templates here.
export * from "./creator";
export * from "./hero";
export * from "./language";
// `./mermaid` is deliberately NOT re-exported: the pack is DISCONNECTED
// (2026-09-07 — see ../index.ts) and its `@dagrejs/dagre` is a devDependency.
// Re-exporting it here made every host evaluate dagre-layout.js on pack
// load, so a checkout without a node_modules (a clone outside the workspace,
// the CLI's --community-repo) could not load the pack at all. Restore this
// line together with the publisher-array + registry entries once dagre is
// vendored. Source + tests stay in-tree (`./mermaid/index.test.ts` imports
// the pack directly).
export * from "./music";
export * from "./print";
export * from "./science";
export * from "./sales";
export * from "./integrations";
// 2026-10-07, the outreach lane's second batch (ported from the founder's
// demo-lab workspace): one template per pack.
export * from "./retail";
export * from "./devops";
export * from "./insights";
export * from "./devtools";
