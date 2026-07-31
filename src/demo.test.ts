import { describe, expect, it } from "vitest";
import { demoReplyFor } from "./components/DemoWorkspace";

describe("public demo response model", () => {
  it("keeps launch questions focused on the underlying constraint", () => {
    expect(demoReplyFor("Can we keep the launch date?")).toContain("protecting momentum");
  });

  it("turns support questions into a concrete next move", () => {
    expect(demoReplyFor("I need a support handoff")).toContain("support rotation");
  });

  it("has a safe general response for an open reflection", () => {
    expect(demoReplyFor("I am not sure what I need")).toContain("underneath the first position");
  });
});
