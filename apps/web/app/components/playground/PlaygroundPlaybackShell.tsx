'use client';

import type { ReactNode, RefObject } from 'react';
import { BrandMark, SidebarBrandBackdrop } from '@/components/BrandBackdrop';

interface PlaygroundPlaybackShellProps {
  title: string;
  badge?: string;
  actions?: ReactNode;
  showSidebarBrand?: boolean;
  containerRef?: RefObject<HTMLDivElement | null>;
  className?: string;
  children: ReactNode;
}

/** Shared IDE chrome around <ScrimPlayer> — topbar + sidebar brand wash. */
export default function PlaygroundPlaybackShell({
  title,
  badge = 'Playback',
  actions,
  showSidebarBrand = false,
  containerRef,
  className = '',
  children,
}: PlaygroundPlaybackShellProps) {
  return (
    <div
      className={`flex flex-col bg-background text-foreground font-sans ${className}`}
    >
      <div className="flex items-center justify-between flex-shrink-0 h-[38px] px-4 bg-background border-b border-border shadow-sm z-10">
        <div className="flex items-center gap-2 text-[13px] min-w-0">
          <span className="text-muted-foreground font-medium">Playground</span>
          <span className="text-muted-foreground font-light">/</span>
          <span className="font-semibold text-foreground tracking-wide truncate max-w-64">
            {title}
          </span>
          <span className="ml-2 px-2 py-0.5 rounded bg-accent text-accent-foreground text-[10px] font-bold uppercase tracking-widest">
            {badge}
          </span>
        </div>

        {actions ? (
          <div className="flex items-center gap-3">{actions}</div>
        ) : null}
      </div>

      <div
        ref={containerRef}
        className="relative flex-grow min-h-0 overflow-hidden bg-background"
      >
        {showSidebarBrand ? (
          <>
            <div className="pointer-events-none absolute inset-y-0 left-0 z-0 w-64 overflow-hidden bg-sidebar">
              <SidebarBrandBackdrop />
            </div>
            <div className="pointer-events-none absolute top-0 left-0 z-30 flex h-[38px] items-center px-4">
              <BrandMark className="pointer-events-auto" />
            </div>
          </>
        ) : null}
        {children}
      </div>
    </div>
  );
}
