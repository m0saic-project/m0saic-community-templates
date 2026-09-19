"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const index_1 = require("./index");
describe("DVD Wrap v1 public entry", () => {
    it("exports the template, defaults, cover, and tutorial", () => {
        expect(index_1.DvdWrapV1.id).toBe("@m0saic-dev/print/dvd-wrap/v1");
        expect(index_1.DVD_WRAP_DEFAULT_PROPS.dpi).toBe(300);
        expect(typeof index_1.renderDvdWrapCover).toBe("function");
        expect(typeof index_1.renderDvdWrapTutorial).toBe("function");
    });
});
