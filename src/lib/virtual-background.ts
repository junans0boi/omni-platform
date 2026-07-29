"use client";

import type { ImageSegmenter, ImageSegmenterResult } from "@mediapipe/tasks-vision";

export type VirtualBackgroundMode = "blur" | "office" | "cafe";

const BACKGROUND_IMAGES: Record<Exclude<VirtualBackgroundMode, "blur">, string> = {
  office: "https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1280&q=80",
  cafe: "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&w=1280&q=80",
};

const MODEL_ASSET_PATH =
  "https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite";
const WASM_BASE_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm";

let segmenterPromise: Promise<ImageSegmenter> | null = null;

async function loadSegmenter(): Promise<ImageSegmenter> {
  if (!segmenterPromise) {
    segmenterPromise = (async () => {
      const { FilesetResolver, ImageSegmenter: ImageSegmenterCtor } = await import("@mediapipe/tasks-vision");
      const fileset = await FilesetResolver.forVisionTasks(WASM_BASE_URL);
      try {
        return await ImageSegmenterCtor.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: MODEL_ASSET_PATH, delegate: "GPU" },
          runningMode: "VIDEO",
          outputCategoryMask: false,
          outputConfidenceMasks: true,
        });
      } catch {
        // GPU delegate unavailable on this device/browser — fall back to CPU.
        return ImageSegmenterCtor.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: MODEL_ASSET_PATH, delegate: "CPU" },
          runningMode: "VIDEO",
          outputCategoryMask: false,
          outputConfidenceMasks: true,
        });
      }
    })();
  }
  return segmenterPromise;
}

const bgImageCache = new Map<string, HTMLImageElement>();
function loadBackgroundImage(url: string): Promise<HTMLImageElement> {
  const cached = bgImageCache.get(url);
  if (cached) return Promise.resolve(cached);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      bgImageCache.set(url, img);
      resolve(img);
    };
    img.onerror = () => reject(new Error(`background image load failed: ${url}`));
    img.src = url;
  });
}

/**
 * MediaPipe ImageSegmenter(selfie_segmenter)로 매 프레임 사람/배경 마스크를 뽑아
 * canvas 위에 배경 블러 또는 배경 이미지 + 사람 컷아웃을 합성하고,
 * canvas.captureStream()으로 새 MediaStreamTrack을 만들어 LiveKit publish에 사용한다.
 */
export class VirtualBackgroundProcessor {
  private readonly video: HTMLVideoElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly maskCanvas: HTMLCanvasElement;
  private readonly personCanvas: HTMLCanvasElement;
  private readonly personCtx: CanvasRenderingContext2D;
  private bgImage: HTMLImageElement | null = null;
  private rafId: number | null = null;
  private stopped = false;

  readonly outputTrack: MediaStreamTrack;

  private constructor(
    video: HTMLVideoElement,
    canvas: HTMLCanvasElement,
    private readonly mode: VirtualBackgroundMode,
  ) {
    this.video = video;
    this.canvas = canvas;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("2D canvas context unavailable");
    this.ctx = ctx;

    this.maskCanvas = document.createElement("canvas");
    this.personCanvas = document.createElement("canvas");
    this.personCanvas.width = canvas.width;
    this.personCanvas.height = canvas.height;
    const personCtx = this.personCanvas.getContext("2d", { willReadFrequently: true });
    if (!personCtx) throw new Error("2D canvas context unavailable");
    this.personCtx = personCtx;

    const stream = canvas.captureStream(30);
    const [track] = stream.getVideoTracks();
    if (!track) throw new Error("captureStream produced no video track");
    this.outputTrack = track;
  }

  static async create(sourceTrack: MediaStreamTrack, mode: VirtualBackgroundMode): Promise<VirtualBackgroundProcessor> {
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.srcObject = new MediaStream([sourceTrack]);
    await video.play().catch(() => {});
    await new Promise<void>((resolve) => {
      if (video.readyState >= 2 && video.videoWidth > 0) {
        resolve();
        return;
      }
      video.onloadeddata = () => resolve();
    });

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;

    const processor = new VirtualBackgroundProcessor(video, canvas, mode);
    if (mode !== "blur") {
      processor.bgImage = await loadBackgroundImage(BACKGROUND_IMAGES[mode]);
    }
    const segmenter = await loadSegmenter();
    processor.runLoop(segmenter);
    return processor;
  }

  private drawCover(source: HTMLImageElement | HTMLVideoElement, blurPx = 0) {
    const cw = this.canvas.width;
    const ch = this.canvas.height;
    const iw = source instanceof HTMLVideoElement ? source.videoWidth : source.width;
    const ih = source instanceof HTMLVideoElement ? source.videoHeight : source.height;
    if (!iw || !ih) return;
    const scale = Math.max(cw / iw, ch / ih);
    const dw = iw * scale;
    const dh = ih * scale;
    const dx = (cw - dw) / 2;
    const dy = (ch - dh) / 2;
    this.ctx.save();
    this.ctx.filter = blurPx ? `blur(${blurPx}px)` : "none";
    this.ctx.drawImage(source, dx, dy, dw, dh);
    this.ctx.restore();
  }

  private runLoop(segmenter: ImageSegmenter) {
    const tick = () => {
      if (this.stopped) return;
      if (this.video.readyState >= 2) {
        segmenter.segmentForVideo(this.video, performance.now(), (result) => {
          this.composite(result);
        });
      }
      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  private composite(result: ImageSegmenterResult) {
    const mask = result.confidenceMasks?.[0];
    if (!mask) return;
    const maskData = mask.getAsFloat32Array();
    const mw = mask.width;
    const mh = mask.height;

    // 1) 배경 레이어: 블러 처리된 원본 화면 또는 프리셋 배경 이미지
    if (this.mode === "blur") {
      this.drawCover(this.video, 18);
    } else if (this.bgImage) {
      this.drawCover(this.bgImage);
    }

    // 2) 사람 컷아웃: 원본 프레임 위에 세그멘테이션 마스크를 알파 채널로 적용
    this.personCtx.drawImage(this.video, 0, 0, this.personCanvas.width, this.personCanvas.height);
    const frame = this.personCtx.getImageData(0, 0, this.personCanvas.width, this.personCanvas.height);
    const { data, width, height } = frame;
    for (let y = 0; y < height; y++) {
      const my = Math.min(mh - 1, Math.floor((y / height) * mh));
      const rowOffset = my * mw;
      for (let x = 0; x < width; x++) {
        const mx = Math.min(mw - 1, Math.floor((x / width) * mw));
        const alpha = maskData[rowOffset + mx] ?? 0;
        data[(y * width + x) * 4 + 3] = alpha >= 0.5 ? 255 : Math.round(alpha * 2 * 255);
      }
    }
    this.personCtx.putImageData(frame, 0, 0);

    // 3) 사람 컷아웃을 배경 위에 합성
    this.ctx.drawImage(this.personCanvas, 0, 0);
    mask.close();
  }

  stop() {
    if (this.stopped) return;
    this.stopped = true;
    if (this.rafId != null) cancelAnimationFrame(this.rafId);
    this.outputTrack.stop();
    this.video.pause();
    this.video.srcObject = null;
  }
}
