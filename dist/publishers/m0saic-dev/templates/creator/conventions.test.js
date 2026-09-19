"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const template_utils_1 = require("@m0saic/template-utils");
const drop_calendar_1 = require("./drop-calendar/v1/drop-calendar");
const new_video_story_1 = require("./new-video-story/v1/new-video-story");
const tip_goal_1 = require("./tip-goal/v1/tip-goal");
/**
 * The community build has no `check-registry` stage yet, so the render-time
 * conventions (renders at defaults, bindings sound, svg glyph coverage,
 * deterministic, text fits, cost budget) are stood in here per template.
 * `record: false` keeps the shared findings log clean under jest.
 */
describe("creator pack — render-time conventions at defaults", () => {
    for (const template of [drop_calendar_1.DropCalendarV1, new_video_story_1.NewVideoStoryV1, tip_goal_1.TipGoalV1]) {
        it(`${String(template.id)} carries no error-severity findings`, async () => {
            const audit = await (0, template_utils_1.auditRenderedTemplate)(template, { record: false });
            expect(audit.skipped).toBeUndefined();
            const errors = audit.findings.filter((f) => f.severity === "error");
            expect(errors).toEqual([]);
        }, 60_000);
    }
});
