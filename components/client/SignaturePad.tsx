"use client";
import { useRef, useState, useCallback } from "react";
import { BORDER, css } from "@/lib/styles";
import { clamp }                          from "@/lib/utils";

interface Props {
  onConfirm: (dataUrl: string) => void;
  accepted?: boolean; // e-sign checkbox must be checked before confirm
}

const W = 580;
const H = 160; // bumped from 140 for better mobile signing area

export function SignaturePad({ onConfirm, accepted = true }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing   = useRef(false);
  const lastPt    = useRef({ x: 0, y: 0 });
  const [hasStroke, setHasStroke] = useState(false);

  function pt(canvas: HTMLCanvasElement, clientX: number, clientY: number) {
    const rect   = canvas.getBoundingClientRect();
    const scaleX = W / rect.width;
    const scaleY = H / rect.height;
    return {
      x: clamp((clientX - rect.left) * scaleX, 0, W),
      y: clamp((clientY - rect.top)  * scaleY, 0, H),
    };
  }

  function getCtx() {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.strokeStyle = "#000000";
    ctx.lineWidth   = 2.4;
    ctx.lineCap     = "round";
    ctx.lineJoin    = "round";
    return { canvas, ctx };
  }

  const startDraw = useCallback((x: number, y: number) => {
    const result = getCtx();
    if (!result) return;
    drawing.current = true;
    lastPt.current  = { x, y };
    result.ctx.beginPath();
    result.ctx.arc(x, y, 1.2, 0, Math.PI * 2);
    result.ctx.fill();
    setHasStroke(true);
  }, []);

  const moveDraw = useCallback((x: number, y: number) => {
    if (!drawing.current) return;
    const result = getCtx();
    if (!result) return;
    result.ctx.beginPath();
    result.ctx.moveTo(lastPt.current.x, lastPt.current.y);
    result.ctx.lineTo(x, y);
    result.ctx.stroke();
    lastPt.current = { x, y };
  }, []);

  const endDraw = useCallback(() => { drawing.current = false; }, []);

  function onMouseDown(e: React.MouseEvent<HTMLCanvasElement>) {
    const p = pt(e.currentTarget, e.clientX, e.clientY);
    startDraw(p.x, p.y);
  }
  function onMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    const p = pt(e.currentTarget, e.clientX, e.clientY);
    moveDraw(p.x, p.y);
  }
  function onTouchStart(e: React.TouchEvent<HTMLCanvasElement>) {
    e.preventDefault();
    const t = e.touches[0];
    const p = pt(e.currentTarget, t.clientX, t.clientY);
    startDraw(p.x, p.y);
  }
  function onTouchMove(e: React.TouchEvent<HTMLCanvasElement>) {
    e.preventDefault();
    const t = e.touches[0];
    const p = pt(e.currentTarget, t.clientX, t.clientY);
    moveDraw(p.x, p.y);
  }

  function handleClear() {
    const result = getCtx();
    if (!result) return;
    result.ctx.clearRect(0, 0, W, H);
    setHasStroke(false);
  }

  function handleConfirm() {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const bg = document.createElement("canvas");
    bg.width  = W;
    bg.height = H;
    const bgCtx = bg.getContext("2d")!;
    bgCtx.fillStyle = "#ffffff";
    bgCtx.fillRect(0, 0, W, H);
    bgCtx.drawImage(canvas, 0, 0);

    onConfirm(bg.toDataURL("image/png"));
  }

  return (
    <div>
      <div className="sig-canvas-wrapper" style={{ position: "relative", marginBottom: 14 }}>
        <canvas
          ref={canvasRef}
          width={W}
          height={H}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={endDraw}
          onMouseLeave={endDraw}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={endDraw}
          style={{
            width:        "100%",
            height:       "auto",
            aspectRatio:  `${W}/${H}`,
            background:   "#fff",
            borderRadius: 6,
            border:       `1px solid ${BORDER}`,
            cursor:       "crosshair",
            touchAction:  "none",
            display:      "block",
          }}
        />
        {!hasStroke && (
          <div style={{
            position:      "absolute",
            inset:         0,
            display:       "flex",
            alignItems:    "center",
            justifyContent: "center",
            pointerEvents: "none",
            fontSize:      13,
            color:         "#bbb",
            letterSpacing: "0.5px",
            fontFamily:    "var(--font-body)",
          }}>
            Draw your signature here
          </div>
        )}
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button onClick={handleClear} style={{ ...css.btnS, padding: "9px 18px", fontSize: 12 }}>
          Clear
        </button>
        {hasStroke && (
          <button
            onClick={handleConfirm}
            disabled={!accepted}
            style={{
              ...css.btnP,
              padding:  "9px 24px",
              fontSize: 12,
              opacity:  accepted ? 1 : 0.3,
              cursor:   accepted ? "pointer" : "not-allowed",
              flex:     1,
              minWidth: 200,
            }}
            title={accepted ? undefined : "Accept the e-signature terms below first"}
          >
            {accepted ? "CONFIRM SIGNATURE →" : "ACCEPT TERMS BELOW FIRST"}
          </button>
        )}
      </div>
    </div>
  );
}
