import { templateRegistry } from "./template-registry";
import { TEMPLATE_PACKS } from "./repo";

describe("community template registry", () => {
  it("publishes DVD Wrap through m0saic-dev's print pack", () => {
    expect(
      templateRegistry.find(
        (entry) => entry.templateId === "@m0saic-dev/print/dvd-wrap/v1",
      ),
    ).toMatchObject({
      slug: "dvd-wrap",
      exportName: "DvdWrapV1",
      title: "DVD Wrap",
      author: "m0saic-dev",
      tags: expect.arrayContaining(["print", "packaging", "batch", "barcode"]),
    });
    expect(TEMPLATE_PACKS.find((pack) => pack.id === "print")).toMatchObject({
      title: "Print Production",
      publisher: "m0saic-dev",
    });
  });

  it("credits every entry to its publisher handle", () => {
    for (const entry of templateRegistry) {
      expect(entry.templateId.startsWith(`@${entry.author}/`)).toBe(true);
    }
  });
});
