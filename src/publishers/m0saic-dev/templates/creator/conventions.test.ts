import { auditRenderedTemplate } from "@m0saic/template-utils";

import { DropCalendarV1 } from "./drop-calendar/v1/drop-calendar";
import { NewVideoStoryV1 } from "./new-video-story/v1/new-video-story";
import { TipGoalV1 } from "./tip-goal/v1/tip-goal";

/**
 * The community build has no `check-registry` stage yet, so the render-time
 * conventions (renders at defaults, bindings sound, svg glyph coverage,
 * deterministic, text fits, cost budget) are stood in here per template.
 * `record: false` keeps the shared findings log clean under jest.
 */
describe("creator pack — render-time conventions at defaults", () => {
  for (const template of [DropCalendarV1, NewVideoStoryV1, TipGoalV1]) {
    it(`${String(template.id)} carries no error-severity findings`, async () => {
      const audit = await auditRenderedTemplate(template, { record: false });
      expect(audit.skipped).toBeUndefined();
      const errors = audit.findings.filter((f) => f.severity === "error");
      expect(errors).toEqual([]);
    }, 60_000);
  }
});
