'use client';
import { useEffect, useRef, useState, type PointerEvent } from 'react';

interface SignaturePadProps {
  onSave: (dataUrl: string) => void;
  onCancel: () => void;
}

const HEIGHT = 180;

function cropToInk(canvas: HTMLCanvasElement): string {
  const { width, height } = canvas;
  const data = canvas.getContext('2d')!.getImageData(0, 0, width, height).data;
  let minX = width, minY = height, maxX = -1, maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > 0) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  const pad = 12;
  const sx = Math.max(0, minX - pad), sy = Math.max(0, minY - pad);
  const sw = Math.min(width, maxX + pad) - sx, sh = Math.min(height, maxY + pad) - sy;
  const out = document.createElement('canvas');
  out.width = sw;
  out.height = sh;
  out.getContext('2d')!.drawImage(canvas, sx, sy, sw, sh, 0, 0, sw, sh);
  return out.toDataURL('image/png');
}

export default function SignaturePad({ onSave, onCancel }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const [empty, setEmpty] = useState(true);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ratio = window.devicePixelRatio || 1;
    canvas.width = canvas.offsetWidth * ratio;
    canvas.height = HEIGHT * ratio;
    const ctx = canvas.getContext('2d')!;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#111';
  }, []);

  function point(e: PointerEvent<HTMLCanvasElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  function down(e: PointerEvent<HTMLCanvasElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = true;
    last.current = point(e);
  }

  function move(e: PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current || !last.current) return;
    const ctx = e.currentTarget.getContext('2d')!;
    const p = point(e);
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last.current = p;
    setEmpty(false);
  }

  function up() {
    drawing.current = false;
    last.current = null;
  }

  function clear() {
    const canvas = canvasRef.current!;
    canvas.getContext('2d')!.clearRect(0, 0, canvas.width, canvas.height);
    setEmpty(true);
  }

  return (
    <div>
      <div className="relative overflow-hidden rounded-2xl bg-[#fbfbfa]">
        <canvas
          ref={canvasRef}
          style={{ height: HEIGHT }}
          className="block w-full touch-none cursor-crosshair"
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerLeave={up}
        />
        <div className="pointer-events-none absolute inset-x-6 bottom-9 border-t border-black/25" />
        {empty && (
          <p className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 text-center text-[14px] text-black/30">
            Sign here with your finger or mouse
          </p>
        )}
      </div>
      <div className="mt-3 flex items-center justify-between">
        <button type="button" onClick={clear} className="h-10 rounded-full px-4 text-[14px] text-white/50 transition hover:text-white/85">
          Clear
        </button>
        <div className="flex gap-2">
          <button type="button" onClick={onCancel} className="h-10 rounded-full px-4 text-[14px] text-white/55 transition hover:bg-white/[0.05] hover:text-white/85">
            Cancel
          </button>
          <button
            type="button"
            disabled={empty}
            onClick={() => onSave(cropToInk(canvasRef.current!))}
            className="h-10 rounded-full bg-white/90 px-5 text-[14px] font-medium text-ink-950 transition hover:bg-white disabled:opacity-40"
          >
            Save signature
          </button>
        </div>
      </div>
    </div>
  );
}
