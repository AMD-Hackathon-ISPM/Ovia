import { useCallback, useRef, useState, type ReactNode } from "react";

/**
 * Zoom and pan viewer for the submitted sonogram (FE-8).
 *
 * Locked: the sonogram is never filtered, tinted, or enhanced. No CSS filter,
 * blend mode, opacity, or colour is applied to the <img>. The stage behind it
 * is a flat inverse surface so the greyscale reads correctly; that surface is
 * not composited with the image.
 *
 * Any overlay is rendered as a sibling INSIDE the transformed box, so it tracks
 * zoom and pan without the image being altered to accommodate it.
 */

const MIN_SCALE = 1;
const MAX_SCALE = 4;
const SCALE_STEP = 0.5;
const PAN_STEP_PX = 24;

export default function ImageViewer({
  src,
  alt,
  overlay,
  className,
}: {
  src: string;
  alt: string;
  overlay?: ReactNode;
  className?: string;
}) {
  const [scale, setScale] = useState(MIN_SCALE);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{ x: number; y: number } | null>(null);

  const zoomBy = useCallback((delta: number) => {
    setScale((prev) => {
      const next = Math.min(MAX_SCALE, Math.max(MIN_SCALE, prev + delta));
      if (next === MIN_SCALE) setOffset({ x: 0, y: 0 });
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    setScale(MIN_SCALE);
    setOffset({ x: 0, y: 0 });
  }, []);

  const canPan = scale > MIN_SCALE;

  function onPointerDown(event: React.PointerEvent) {
    if (!canPan) return;
    dragRef.current = { x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: React.PointerEvent) {
    const start = dragRef.current;
    if (!start) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    dragRef.current = { x: event.clientX, y: event.clientY };
    setOffset((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
  }

  function onPointerUp(event: React.PointerEvent) {
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function onKeyDown(event: React.KeyboardEvent) {
    switch (event.key) {
      case "ArrowLeft":
        if (!canPan) return;
        setOffset((p) => ({ ...p, x: p.x + PAN_STEP_PX }));
        break;
      case "ArrowRight":
        if (!canPan) return;
        setOffset((p) => ({ ...p, x: p.x - PAN_STEP_PX }));
        break;
      case "ArrowUp":
        if (!canPan) return;
        setOffset((p) => ({ ...p, y: p.y + PAN_STEP_PX }));
        break;
      case "ArrowDown":
        if (!canPan) return;
        setOffset((p) => ({ ...p, y: p.y - PAN_STEP_PX }));
        break;
      case "+":
      case "=":
        zoomBy(SCALE_STEP);
        break;
      case "-":
        zoomBy(-SCALE_STEP);
        break;
      case "0":
        reset();
        break;
      default:
        return;
    }
    event.preventDefault();
  }

  return (
    <div className={className}>
      <div
        role="group"
        aria-label="Ultrasound image viewer. Arrow keys pan when zoomed. Plus and minus zoom. Zero resets."
        tabIndex={0}
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className={`relative aspect-[4/3] w-full touch-none overflow-hidden rounded-2xl bg-neutral-900
                    focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none
                    ${canPan ? "cursor-grab active:cursor-grabbing" : ""}`}
      >
        <div
          className="absolute inset-0 origin-center will-change-transform"
          style={{
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
          }}
        >
          {/* No filter, no tint, no blend mode. */}
          <img
            src={src}
            alt={alt}
            draggable={false}
            className="pointer-events-none h-full w-full object-contain select-none"
          />
          {overlay}
        </div>
      </div>

      <div className="mt-2 flex items-center gap-2">
        <ViewerButton onClick={() => zoomBy(-SCALE_STEP)} disabled={scale <= MIN_SCALE}>
          <span aria-hidden="true">−</span>
          <span className="sr-only">Zoom out</span>
        </ViewerButton>
        <ViewerButton onClick={() => zoomBy(SCALE_STEP)} disabled={scale >= MAX_SCALE}>
          <span aria-hidden="true">+</span>
          <span className="sr-only">Zoom in</span>
        </ViewerButton>
        <ViewerButton onClick={reset} disabled={scale === MIN_SCALE && offset.x === 0 && offset.y === 0}>
          Reset
        </ViewerButton>
        <p className="ml-auto text-xs text-muted-foreground" aria-live="polite">
          {scale.toFixed(1)}×
        </p>
      </div>
    </div>
  );
}

function ViewerButton({
  onClick,
  disabled,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="h-9 min-w-9 rounded-lg border border-border px-3 text-sm font-medium
                 hover:bg-muted disabled:opacity-40
                 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
    >
      {children}
    </button>
  );
}
