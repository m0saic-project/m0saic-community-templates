import { DvdWrapV1 } from "./index";

describe("DVD Wrap family entry", () => {
  it("exports v1", () => {
    expect(DvdWrapV1.id).toBe("@m0saic-dev/print/dvd-wrap/v1");
  });
});
