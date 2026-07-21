import { describe, expect, it } from "vitest";
import { evaluateCutover, getPlatformAuthority, rollbackStrategy } from "../../src/lib/platform-authority";

describe("platform authority gate", () => {
  it("defaults safely to legacy and rejects split or unknown modes", () => {
    expect(getPlatformAuthority({})).toBe("legacy");
    expect(getPlatformAuthority({ OMNI_PLATFORM_BACKEND: "supabase" })).toBe("supabase");
    expect(() => getPlatformAuthority({ OMNI_PLATFORM_BACKEND: "mixed" })).toThrow();
  });

  it("stops on any integrity, auth, realtime, error, or latency breach", () => {
    expect(evaluateCutover({ unexplainedMismatches: 0, authorizationFailures: 0, realtimeDeliveryFailures: 0, errorRatePercent: 1, p95LatencyMs: 750 }).proceed).toBe(true);
    expect(evaluateCutover({ unexplainedMismatches: 1, authorizationFailures: 0, realtimeDeliveryFailures: 0, errorRatePercent: 0, p95LatencyMs: 100 })).toEqual({
      proceed: false,
      reasons: ["reconciliation mismatch"],
    });
  });

  it("never blindly switches database authority after a Supabase write", () => {
    expect(rollbackStrategy(false)).toBe("switch-to-legacy");
    expect(rollbackStrategy(true)).toBe("freeze-and-reconcile");
  });
});
