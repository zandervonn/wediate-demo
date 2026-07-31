import { describe, expect, it } from "vitest";
import { MOCK_MODE_LABEL, MOCK_MODE_NOTICE } from "./mockMode";

describe("public demo boundary", () => {
  it("labels the visible experience as a local mock", () => {
    expect(MOCK_MODE_LABEL).toBe("Mock session");
    expect(MOCK_MODE_NOTICE).toContain("no API calls");
    expect(MOCK_MODE_NOTICE).toContain("prompts stay private");
  });
});
