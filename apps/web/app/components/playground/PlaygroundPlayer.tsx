'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Globe, X } from 'lucide-react';
import type { RecordingSession } from '@thisisayande/openscrim-core';
import {
  ScrimPlayer,
  type PlayerFiles,
  type ScrimForkContent,
  type ScrimForkDraft,
  type ScrimForkEdits,
  type ScrimForkMarker,
} from '@thisisayande/openscrim-react';
import { useAuth } from '@/hooks/useAuth';
import { getRecordingStorage } from '@/lib/storage';
import {
  createFork,
  deleteFork as deleteForkFromStorage,
  getFork,
  getForks,
  updateForkEdits,
} from '@/lib/forkStorage';
import { CODE_ROOT } from '@/components/playground/fileStore';
import FloatingPreviewWindow from '@/components/playground/FloatingPreviewWindow';

interface PlaygroundPlayerProps {
  sessionId: string;
}

/**
 * Plays a recording back inside the playground IDE chrome. The whole player
 * surface — file tree, tabs, transport, forking, pointer — is the OpenScrim
 * React SDK's <ScrimPlayer>; this component only supplies app chrome (topbar,
 * floating browser preview) and wires forking to IndexedDB fork storage.
 */
export default function PlaygroundPlayer({ sessionId }: PlaygroundPlayerProps) {
  const { isAuthenticated } = useAuth();

  const [session, setSession] = useState<RecordingSession | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [forks, setForks] = useState<ScrimForkMarker[]>([]);
  const [files, setFiles] = useState<Record<string, string>>({});
  const [isForking, setIsForking] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(true);
  const playAreaRef = useRef<HTMLDivElement>(null);

  // Load the recording + its forks.
  useEffect(() => {
    let cancelled = false;
    const storage = getRecordingStorage(() => isAuthenticated);

    Promise.all([storage.load(sessionId), storage.getEvents(sessionId)])
      .then(([meta, events]) => {
        if (cancelled) return;
        if (!meta) return setLoadError('Recording not found');
        setSession({ ...meta, events });
      })
      .catch((err) => {
        console.error('Failed to load recording:', err);
        if (!cancelled) setLoadError('Failed to load recording');
      });

    getForks(sessionId)
      .then((f) => {
        if (!cancelled) {
          setForks(f.map((fork) => ({ id: fork.id, timestamp: fork.timestamp })));
        }
      })
      .catch(console.error);

    return () => {
      cancelled = true;
    };
  }, [sessionId, isAuthenticated]);

  const handleCreateFork = useCallback(
    async (draft: ScrimForkDraft): Promise<ScrimForkMarker> => {
      const fork = await createFork({
        recordingId: sessionId,
        timestamp: draft.timestamp,
        content: draft.content,
        language: draft.language,
        cursor: draft.cursor,
        files: draft.files,
        activePath: draft.activePath ?? undefined,
      });
      const marker: ScrimForkMarker = { id: fork.id, timestamp: fork.timestamp };
      setForks((prev) =>
        [...prev, marker].sort((a, b) => a.timestamp - b.timestamp)
      );
      return marker;
    },
    [sessionId]
  );

  const handleSaveFork = useCallback((id: string, edits: ScrimForkEdits) => {
    updateForkEdits(id, edits.content, edits.cursor, {
      files: edits.files,
      activePath: edits.activePath ?? undefined,
    }).catch(console.error);
  }, []);

  const handleOpenFork = useCallback(
    async (id: string): Promise<ScrimForkContent> => {
      const fork = await getFork(id);
      if (!fork) return { content: '' };
      const path = fork.activePath;
      return {
        content: path ? (fork.files?.[path] ?? fork.edits) : fork.edits,
        language: fork.language,
        cursor: fork.cursor,
        files: fork.files,
        activePath: fork.activePath ?? null,
      };
    },
    []
  );

  const handleDeleteFork = useCallback(async (id: string) => {
    await deleteForkFromStorage(id);
    setForks((prev) => prev.filter((f) => f.id !== id));
  }, []);

  const handleFilesChange = useCallback((f: PlayerFiles) => setFiles(f.files), []);

  if (loadError) {
    return (
      <div className="h-screen flex flex-col items-center justify-center gap-4 bg-background text-foreground">
        <p className="text-muted-foreground">{loadError}</p>
        <Link
          href="/editor"
          className="px-4 py-2 rounded bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          Back to Playground
        </Link>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-background text-foreground font-sans">
      {/* Topbar — same chrome as the playground editor */}
      <div className="flex items-center justify-between flex-shrink-0 h-[38px] px-4 bg-background border-b border-border shadow-sm z-10">
        <div className="flex items-center gap-2 text-[13px]">
          <Link href="/" className="font-bold select-none mr-2 flex items-center" title="OpenScrim">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-primary">
              <path d="M12 2L2 7L12 12L22 7L12 2Z" fill="currentColor" />
              <path d="M2 17L12 22L22 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M2 12L12 17L22 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
          <span className="text-muted-foreground font-light">/</span>
          <span className="text-muted-foreground font-medium">Playground</span>
          <span className="text-muted-foreground font-light">/</span>
          <span className="font-semibold text-foreground tracking-wide truncate max-w-64">
            {session?.title ?? 'Loading…'}
          </span>
          <span className="ml-2 px-2 py-0.5 rounded bg-accent text-accent-foreground text-[10px] font-bold uppercase tracking-widest">
            {isForking ? 'Forking' : 'Playback'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsPreviewOpen((v) => !v)}
            className={`flex items-center justify-center w-7 h-7 rounded hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer ${
              isPreviewOpen ? 'bg-accent text-accent-foreground' : 'text-muted-foreground'
            }`}
            title="Toggle Browser Preview"
          >
            <Globe size={16} />
          </button>
          <Link
            href="/editor"
            className="flex items-center gap-1.5 px-3 py-1 rounded text-[11px] font-bold tracking-wider text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            title="Exit playback"
          >
            <X size={13} />
            EXIT
          </Link>
        </div>
      </div>

      <div ref={playAreaRef} className="relative flex-grow min-h-0 overflow-hidden bg-background">
        <ScrimPlayer
          session={session ?? undefined}
          height="100%"
          forks={forks}
          onCreateFork={handleCreateFork}
          onSaveFork={handleSaveFork}
          onOpenFork={handleOpenFork}
          onDeleteFork={handleDeleteFork}
          onFilesChange={handleFilesChange}
          onForkModeChange={setIsForking}
          style={{ border: 'none', borderRadius: 0, boxShadow: 'none' }}
        />

        {/* Browser preview — live output of the played-back (or forked) code */}
        <FloatingPreviewWindow
          store={{ files, dirs: [CODE_ROOT] }}
          open={isPreviewOpen}
          onClose={() => setIsPreviewOpen(false)}
          containerRef={playAreaRef}
        />
      </div>
    </div>
  );
}
