import { auditRenderedTemplate } from "@m0saic/template-utils";

import { DropCalendarV1 } from "./drop-calendar/v1/drop-calendar";
import { NewVideoStoryV1 } from "./new-video-story/v1/new-video-story";
import { TipGoalV1 } from "./tip-goal/v1/tip-goal";

/**
 * The community build has no `check-registry` stage yet, so the render-time
 * conventions (renders at defaults, bindings sound, svg glyph coverage,
 * deterministic, text fits, cost budget) are stood in here per template.
 * `record: false` keeps the shared findings log clean under jest.
 *
 * The pack SHIPPED on the m0saic 0.2.0 line (it is hashed in
 * `frozen.manifest.json`, whose `release` is the community tag, not the m0saic
 * line), so the conventions that landed with 0.3.0 — `bindingsDeclared`,
 * `canvasFill`, `bindingHints` — and 0.3.1's `catalogSidecar` (their files
 * describe themselves; since 0.3.1 that lives in template-catalog.json) —
 * report in `lagging`, not `findings`: behind, not broken, and the fix is each
 * template's next vN. Without `shippedAt` this test failed on every one of
 * them from the day they landed.
 */
describe("creator pack — render-time conventions at defaults", () => {
  for (const template of [DropCalendarV1, NewVideoStoryV1, TipGoalV1]) {
    it(`${String(template.id)} carries no error-severity findings for the line it shipped at`, async () => {
      const audit = await auditRenderedTemplate(template, { record: false, shippedAt: "0.2.0" });
      expect(audit.skipped).toBeUndefined();
      const errors = audit.findings.filter((f) => f.severity === "error");
      expect(errors).toEqual([]);
      // Visible, never fatal: what the next vN of each clears.
      for (const f of audit.lagging) expect(["bindingsDeclared", "canvasFill", "bindingHints", "catalogSidecar"]).toContain(f.convention);
    }, 60_000);
  }
});
