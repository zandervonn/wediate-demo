import { describe, expect, it } from "vitest";
import { PUBLIC_PREVIEW_LABEL, PUBLIC_PREVIEW_NOTICE } from "./mockMode";

describe("public demo boundary", () => {
  it("labels the visible experience as a local preview", () => {
    expect(PUBLIC_PREVIEW_LABEL).toBe("Public preview");
    expect(PUBLIC_PREVIEW_NOTICE).toContain("no API calls");
    expect(PUBLIC_PREVIEW_NOTICE).toContain("prompts stay private");
  });
});
