"use client";

import React, { useRef, useState, useEffect } from "react";
import { Palette, Eraser, RotateCcw } from "lucide-react";

export function CanvasView({ channelId, channelName }: { channelId: string; channelName: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [color, setColor] = useState("#6366f1");
  const [lineWidth, setLineWidth] = useState(3);
  const [isEraser, setIsEraser] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set background fill
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }, [channelId]);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    ctx.beginPath();
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.strokeStyle = isEraser ? "#0f172a" : color;
    ctx.lineWidth = isEraser ? lineWidth * 4 : lineWidth;
    ctx.lineCap = "round";
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  };

  return (
    <div className="flex flex-1 flex-col h-full bg-surface p-6 overflow-hidden">
      <div className="flex items-center justify-between border-b border-line pb-4 mb-4">
        <div className="flex items-center gap-2">
          <Palette className="h-5 w-5 text-purple-400" />
          <h2 className="text-sm font-bold text-text">{channelName} - 화이트보드 캔버스</h2>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-3 bg-surface-2 p-1.5 rounded-xl border border-line">
          <input
            type="color"
            value={color}
            onChange={(e) => { setColor(e.target.value); setIsEraser(false); }}
            className="h-6 w-6 rounded border-none bg-transparent cursor-pointer"
          />
          <input
            type="range"
            min="1"
            max="10"
            value={lineWidth}
            onChange={(e) => setLineWidth(Number(e.target.value))}
            className="w-20 cursor-pointer"
          />
          <button
            onClick={() => setIsEraser(!isEraser)}
            title="지우개"
            className={`p-1.5 rounded-lg transition ${isEraser ? "bg-accent text-on-accent" : "text-muted hover:text-text"}`}
          >
            <Eraser className="h-4 w-4" />
          </button>
          <button
            onClick={clearCanvas}
            title="전체 지우기"
            className="p-1.5 rounded-lg text-muted hover:text-danger transition"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 rounded-2xl border border-line overflow-hidden shadow-inner flex items-center justify-center bg-slate-950">
        <canvas
          ref={canvasRef}
          width={900}
          height={600}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          className="cursor-crosshair rounded-xl touch-none"
        />
      </div>
    </div>
  );
}
