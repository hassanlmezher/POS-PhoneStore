"use client";

import { useEffect, useImperativeHandle, useRef } from "react";
import { cn } from "@/lib/utils";

export type SignaturePadHandle = {
  clear: () => void;
  isEmpty: () => boolean;
  /** PNG of the drawing (transparent background), or null when nothing was drawn. */
  toBlob: () => Promise<Blob | null>;
};

type Props = {
  ref?: React.Ref<SignaturePadHandle>;
  /** Called when the pad goes from empty to drawn (or back after clear). */
  onDrawnChange?: (drawn: boolean) => void;
  className?: string;
  label: string;
};

/** Finger/mouse/stylus signature on a canvas (pointer events, sharp on high-DPI screens). No dependency. */
export function SignaturePad({ ref, onDrawnChange, className, label }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawn = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ratio = Math.max(1, window.devicePixelRatio || 1);
    // offset* ignores CSS transforms (the dialog zooms in while opening).
    const width = canvas.offsetWidth;
    const height = canvas.offsetHeight;
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    const ctx = canvas.getContext("2d")!;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#111827";
  }, []);

  const point = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  useImperativeHandle(ref, () => ({
    clear() {
      const canvas = canvasRef.current!;
      canvas.getContext("2d")!.clearRect(0, 0, canvas.width, canvas.height);
      if (drawn.current) onDrawnChange?.(false);
      drawn.current = false;
    },
    isEmpty: () => !drawn.current,
    toBlob: () =>
      new Promise((resolve) => {
        if (!drawn.current) return resolve(null);
        canvasRef.current!.toBlob((b) => resolve(b), "image/png");
      }),
  }));

  return (
    <canvas
      ref={canvasRef}
      role="img"
      aria-label={label}
      className={cn("h-48 w-full touch-none rounded-lg border-2 border-dashed bg-white", className)}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        last.current = point(e);
      }}
      onPointerMove={(e) => {
        if (!last.current) return;
        const ctx = e.currentTarget.getContext("2d")!;
        const p = point(e);
        ctx.beginPath();
        ctx.moveTo(last.current.x, last.current.y);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
        last.current = p;
        if (!drawn.current) {
          drawn.current = true;
          onDrawnChange?.(true);
        }
      }}
      onPointerUp={() => (last.current = null)}
      onPointerCancel={() => (last.current = null)}
    />
  );
}
