import { describe, expect, it } from "vitest";
import {
  NEUTRAL_DISPLAY_ROLE,
  resolveDisplayRole,
  validateRoleAppearance,
} from "../../src/lib/role-appearance";

describe("display Role resolver", () => {
  it("uses highest position with a stable id tie-break", () => {
    const roles = [
      { id: "b", name: "Blue", position: 5, colorHex: "#0000FF", badgeKey: "star" },
      { id: "a", name: "Admin", position: 5, colorHex: "#FF0000", badgeKey: "shield" },
      { id: "z", name: "Low", position: 1, colorHex: null, badgeKey: null },
    ];
    expect(resolveDisplayRole(roles)).toEqual({
      id: "a",
      name: "Admin",
      colorHex: "#FF0000",
      badgeKey: "shield",
    });
  });

  it("rejects unsafe appearance and returns an accessible neutral fallback", () => {
    expect(validateRoleAppearance("red", "custom-url")).toBe(false);
    expect(resolveDisplayRole([{ id: "x", name: "Bad", position: 10, colorHex: "red", badgeKey: null }]))
      .toEqual(NEUTRAL_DISPLAY_ROLE);
  });
});
