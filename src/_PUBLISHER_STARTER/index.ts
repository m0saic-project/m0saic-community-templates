// Copy this folder to src/publishers/<your-publisher-handle>/ then:
//
//  1. Fill in ./publisher.ts (your handle, display name, entryModule path).
//  2. Author templates under ./templates/<pack>/<slug>/vN/ with ids shaped
//     `@<your-handle>/<pack>/<slug>/vN`, export the template objects (no
//     self-registration — the host decides what to register), and list them
//     in `templates` below.
//  3. Add one line to ../index.ts PUBLISHER_ENTRIES:
//       "<your-handle>": () => require("./<your-handle>") as PublisherModule,
//  4. Add a registry entry per template in ../../template-registry.ts
//     (author = your handle) and rebuild — the manifest generator enforces
//     the rest.

export { publisher } from "./publisher";
export * from "./templates";

/** Every template this publisher ships, in stable order. */
export const templates = [
  // MyTemplateV1,
];
