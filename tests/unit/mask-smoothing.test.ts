import { describe, expect, it } from "vitest";
import { blendMaskInPlace } from "../../src/lib/mask-smoothing";

describe("blendMaskInPlace", () => {
  it("moves partway toward the incoming frame, not all the way", () => {
    const running = Float32Array.from([0]);
    blendMaskInPlace(running, Float32Array.from([1]), 0.35);
    expect(running[0]).toBeCloseTo(0.35, 5);
  });

  it("damps a single-frame outlier instead of snapping to it", () => {
    const running = Float32Array.from([1, 1, 1]);
    blendMaskInPlace(running, Float32Array.from([0, 0, 0]), 0.35);
    for (const v of running) expect(v).toBeGreaterThan(0.5);
  });

  it("converges to a steady incoming value over repeated frames", () => {
    const running = Float32Array.from([0]);
    for (let i = 0; i < 50; i++) blendMaskInPlace(running, Float32Array.from([1]), 0.35);
    expect(running[0]).toBeCloseTo(1, 5);
  });

  it("smoothing=1 reproduces the raw frame immediately", () => {
    const running = Float32Array.from([0.2, 0.8]);
    blendMaskInPlace(running, Float32Array.from([0.9, 0.1]), 1);
    expect(running[0]).toBeCloseTo(0.9, 5);
    expect(running[1]).toBeCloseTo(0.1, 5);
  });
});
