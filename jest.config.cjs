const { createDefaultPreset } = require("ts-jest");

/** @type {import("jest").Config} */
module.exports = {
  testEnvironment: "node",
  // Declare the repo's catalog before any test imports a template module —
  // a sidecar-described template (label, tags, prop placeholders in its
  // `<name>.catalog.json`) is defined at import, and the definition-time
  // conventions judge it with the catalog applied, as the build does.
  setupFiles: ["<rootDir>/src/catalog.ts"],
  transform: {
    ...createDefaultPreset({ tsconfig: "./tsconfig.json" }).transform,
  },
  testMatch: [
    "<rootDir>/src/**/*.test.ts",
    "<rootDir>/__tests__/**/*.test.ts",
  ],
  testPathIgnorePatterns: ["/node_modules/", "/dist/"],
};
