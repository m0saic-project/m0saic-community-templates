import {
  DVD_WRAP_DEFAULT_PROPS,
  DvdWrapV1,
  renderDvdWrapCover,
  renderDvdWrapTutorial,
} from "./index";

describe("DVD Wrap v1 public entry", () => {
  it("exports the template, defaults, cover, and tutorial", () => {
    expect(DvdWrapV1.id).toBe("@m0saic-dev/print/dvd-wrap/v1");
    expect(DVD_WRAP_DEFAULT_PROPS.dpi).toBe(300);
    expect(typeof renderDvdWrapCover).toBe("function");
    expect(typeof renderDvdWrapTutorial).toBe("function");
  });
});
