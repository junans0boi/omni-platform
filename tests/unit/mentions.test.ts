import { describe, expect, it } from "vitest";
import { resolveMentionRecipients, validateCustomStatus } from "../../src/lib/mentions";

const members = [
  { profileId: "a", online: true },
  { profileId: "b", online: false },
  { profileId: "c", online: true },
];

describe("structured mention semantics", () => {
  it("snapshots here from online members and everyone from membership", () => {
    expect(resolveMentionRecipients({ kind: "HERE" }, members, true)).toEqual(["a", "c"]);
    expect(resolveMentionRecipients({ kind: "EVERYONE" }, members, true)).toEqual(["a", "b", "c"]);
  });

  it("rejects unauthorized global and non-member profile mentions", () => {
    expect(() => resolveMentionRecipients({ kind: "EVERYONE" }, members, false)).toThrow(
      "Global mention permission required",
    );
    expect(() => resolveMentionRecipients({ kind: "PROFILE", profileId: "outsider" }, members, true)).toThrow(
      "Mention target is not a member",
    );
  });

  it("normalizes bounded custom status", () => {
    expect(validateCustomStatus("  heads down  ")).toBe("heads down");
    expect(validateCustomStatus(" ")).toBeNull();
    expect(() => validateCustomStatus("x".repeat(129))).toThrow();
  });
});
