'use client';

import { useEffect, useRef, useState } from 'react';
import PreviewBrowser from './PreviewBrowser';
import type { PlaygroundFiles } from './fileStore';

type PreviewInteraction =
  | 'move'
  | 'n'
  | 's'
  | 'e'
  | 'w'
  | 'ne'
  | 'nw'
  | 'se'
  | 'sw';

const PREVIEW_MIN_W = 256;
const PREVIEW_MIN_H = 192;
const PREVIEW_DEFAULT_W = 340;
const PREVIEW_DEFAULT_H = 420;

interface FloatingPreviewWindowProps {
  store: PlaygroundFiles;
  open: boolean;
  onClose: () => void;
  /** The area the window floats over; used for initial bottom-right placement. */
  containerRef: React.RefObject<HTMLDivElement | null>;
}

/**
 * The browser preview as a floating window — draggable by its header and
 * resizable from all edges/corners. Shared by the playground editor and the
 * playback view.
 */
export default function FloatingPreviewWindow({
  store,
  open,
  onClose,
  containerRef,
}: FloatingPreviewWindowProps) {
  const [rect, setRect] = useState<{
    x: number;
    y: number;
    w: number;
    h: number;
  } | null>(null);
  const [isInteracting, setIsInteracting] = useState(false);
  const interactionRef = useRef<{
    mode: PreviewInteraction;
    startX: number;
    startY: number;
    base: { x: number; y: number; w: number; h: number };
  } | null>(null);

  // Place the window bottom-right once the container has a measurable size
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    setRect(
      (prev) =>
        prev ?? {
          x: Math.max(el.clientWidth - PREVIEW_DEFAULT_W - 24, 16),
          y: Math.max(el.clientHeight - PREVIEW_DEFAULT_H - 24, 16),
          w: PREVIEW_DEFAULT_W,
          h: PREVIEW_DEFAULT_H,
        }
    );
  }, [containerRef]);

  const startInteraction =
    (mode: PreviewInteraction) => (e: React.PointerEvent) => {
      if (!rect) return;
      e.preventDefault();
      e.stopPropagation();
      interactionRef.current = {
        mode,
        startX: e.clientX,
        startY: e.clientY,
        base: rect,
      };
      setIsInteracting(true);

      const onMove = (ev: PointerEvent) => {
        const s = interactionRef.current;
        if (!s) return;
        const dx = ev.clientX - s.startX;
        const dy = ev.clientY - s.startY;
        let { x, y, w, h } = s.base;

        if (s.mode === 'move') {
          x += dx;
          y += dy;
        } else {
          if (s.mode.includes('e')) w = Math.max(PREVIEW_MIN_W, s.base.w + dx);
          if (s.mode.includes('s')) h = Math.max(PREVIEW_MIN_H, s.base.h + dy);
          if (s.mode.includes('w')) {
            w = Math.max(PREVIEW_MIN_W, s.base.w - dx);
            x = s.base.x + (s.base.w - w);
          }
          if (s.mode.includes('n')) {
            h = Math.max(PREVIEW_MIN_H, s.base.h - dy);
            y = s.base.y + (s.base.h - h);
          }
        }

        setRect({ x, y, w, h });
      };
      const onUp = () => {
        interactionRef.current = null;
        setIsInteracting(false);
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
      };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    };

  return (
    <div
      className={`absolute z-30 flex flex-col rounded-lg border border-border bg-background shadow-2xl transition-opacity duration-200 ${
        open && rect ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}
      style={
        rect
          ? { left: rect.x, top: rect.y, width: rect.w, height: rect.h }
          : undefined
      }
    >
      {/* Edge handles */}
      <div
        onPointerDown={startInteraction('n')}
        className="absolute -top-1 left-2 right-2 h-2 cursor-ns-resize z-10"
      />
      <div
        onPointerDown={startInteraction('s')}
        className="absolute -bottom-1 left-2 right-2 h-2 cursor-ns-resize z-10"
      />
      <div
        onPointerDown={startInteraction('w')}
        className="absolute -left-1 top-2 bottom-2 w-2 cursor-ew-resize z-10"
      />
      <div
        onPointerDown={startInteraction('e')}
        className="absolute -right-1 top-2 bottom-2 w-2 cursor-ew-resize z-10"
      />
      {/* Corner handles */}
      <div
        onPointerDown={startInteraction('nw')}
        className="absolute -top-1 -left-1 w-3.5 h-3.5 cursor-nwse-resize z-20"
      />
      <div
        onPointerDown={startInteraction('ne')}
        className="absolute -top-1 -right-1 w-3.5 h-3.5 cursor-nesw-resize z-20"
      />
      <div
        onPointerDown={startInteraction('sw')}
        className="absolute -bottom-1 -left-1 w-3.5 h-3.5 cursor-nesw-resize z-20"
      />
      <div
        onPointerDown={startInteraction('se')}
        className="absolute -bottom-1 -right-1 w-3.5 h-3.5 cursor-nwse-resize z-20"
      />

      <div
        onPointerDown={startInteraction('move')}
        className="flex items-center justify-between px-3 py-1.5 bg-sidebar border-b border-border cursor-move select-none flex-shrink-0 rounded-t-lg"
      >
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          Preview
        </span>
        <button
          onClick={onClose}
          onPointerDown={(e) => e.stopPropagation()}
          className="text-muted-foreground hover:text-foreground p-0.5 rounded hover:bg-accent cursor-pointer"
          title="Close Preview"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
      <div
        className={`flex-grow min-h-0 overflow-hidden rounded-b-lg ${
          isInteracting ? 'pointer-events-none' : ''
        }`}
      >
        <PreviewBrowser store={store} />
      </div>
    </div>
  );
}
