export type PlatformAuthority = "legacy" | "supabase";

export interface CutoverSignals {
  unexplainedMismatches: number;
  authorizationFailures: number;
  realtimeDeliveryFailures: number;
  errorRatePercent: number;
  p95LatencyMs: number;
}

export const CUTOVER_THRESHOLDS = Object.freeze({
  errorRatePercent: 1,
  p95LatencyMs: 750,
});

export function getPlatformAuthority(env: Record<string, string | undefined> = process.env): PlatformAuthority {
  const value = env.OMNI_PLATFORM_BACKEND?.trim().toLowerCase() || "legacy";
  if (value !== "legacy" && value !== "supabase") {
    throw new Error("OMNI_PLATFORM_BACKEND must be legacy or supabase");
  }
  return value;
}

export function evaluateCutover(signals: CutoverSignals): { proceed: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (signals.unexplainedMismatches > 0) reasons.push("reconciliation mismatch");
  if (signals.authorizationFailures > 0) reasons.push("authorization failure");
  if (signals.realtimeDeliveryFailures > 0) reasons.push("realtime delivery failure");
  if (signals.errorRatePercent > CUTOVER_THRESHOLDS.errorRatePercent) reasons.push("error rate threshold");
  if (signals.p95LatencyMs > CUTOVER_THRESHOLDS.p95LatencyMs) reasons.push("latency threshold");
  return { proceed: reasons.length === 0, reasons };
}

export function rollbackStrategy(firstSupabaseWriteAccepted: boolean):
  | "switch-to-legacy"
  | "freeze-and-reconcile" {
  return firstSupabaseWriteAccepted ? "freeze-and-reconcile" : "switch-to-legacy";
}
