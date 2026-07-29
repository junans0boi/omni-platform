/**
 * Blends a new segmentation mask into a running buffer via exponential
 * moving average, in place. Using the raw per-frame mask directly makes
 * low-confidence pixels near the person's silhouette (e.g. a chair back
 * behind their shoulder) flicker in and out every frame; smoothing across
 * frames damps that noise.
 *
 * `smoothing` is in (0, 1]: 1 disables smoothing (always the latest frame),
 * lower values react more slowly but flicker less.
 */
export function blendMaskInPlace(running: Float32Array, incoming: Float32Array, smoothing: number): void {
  for (let i = 0; i < incoming.length; i++) {
    running[i] = running[i] * (1 - smoothing) + incoming[i] * smoothing;
  }
}
