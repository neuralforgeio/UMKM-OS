"use client";
// Papan tanda tangan â€” Pointer Events (mouse + jari + stylus).
// touch-action:none supaya halaman gak ikut scroll saat pembeli
// menggambar di HP.
import { useEffect, useRef, useState } from "react";

export default function SignaturePad({
  onChange,
}: {
  onChange: (dataUrl: string | null) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const [empty, setEmpty] = useState(true);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.round(rect.width * dpr));
    canvas.height = Math.max(1, Math.round(rect.height * dpr));
    ctx.scale(dpr, dpr);
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#1e293b";
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }, []);

  function pos(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function down(e: React.PointerEvent<HTMLCanvasElement>) {
    e.preventDefault();
    canvasRef.current?.setPointerCapture(e.pointerId);
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    drawingRef.current = true;
    setEmpty(false);
    const p = pos(e);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  }

  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const p = pos(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
  }

  function up() {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    const canvas = canvasRef.current;
    if (canvas) onChange(canvas.toDataURL("image/png"));
  }

  function clear() {
    drawingRef.current = false;
    setEmpty(true);
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (canvas && ctx) {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    onChange(null);
  }

  return (
    <div className="w-full">
      <canvas
        ref={canvasRef}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerLeave={up}
        onPointerCancel={up}
        style={{ touchAction: "none" }}
        // Kanvas tanda tangan = KERTAS bukti (PNG berlatar putih, tinta
        // gelap) â€” sengaja TETAP PUTIH di kedua tema (v1.8.0), seperti
        // kertas struk; garis batasnya saja yang mengikuti tema.
        className="h-40 w-full cursor-crosshair rounded-lg border-2 border-dashed border-slate-300 bg-white dark:border-slate-700"
      />
      <div className="mt-1 flex items-center justify-between">
        <p className="text-[11px] text-slate-500 dark:text-slate-400">
          {empty
            ? "Tanda tangan pembeli di kotak atas"
            : "Sudah ada tanda tangan"}
        </p>
        <button
          type="button"
          onClick={clear}
          className="text-xs text-red-600 dark:text-red-400 underline"
        >
          Hapus
        </button>
      </div>
    </div>
  );
}