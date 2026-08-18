'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { getMaterialFileIcon } from 'file-extension-icon-js';
import {
  ScrimPlayer,
  type PlayerFiles,
  type ScrimForkContent,
  type ScrimForkDraft,
  type ScrimForkEdits,
  type ScrimForkMarker,
} from '@thisisayande/openscrim-react';
import { useThemeBase } from '@/hooks/useThemeBase';
import PlaygroundPlaybackShell from '@/components/playground/PlaygroundPlaybackShell';
import {
  createFork,
  deleteFork as deleteForkFromStorage,
  getFork,
  getForks,
  updateForkEdits,
} from '@/lib/forkStorage';

const DEMO_RECORDING_ID = 'landing-demo';

/**
 * Landing-page proof: the site's own recorded demo, replayed live via the
 * published SDK's <ScrimPlayer>, with forking wired to the same IndexedDB
 * fork storage the /view and /editor playback surfaces use.
 */
export default function LiveDemoSection() {
  const themeBase = useThemeBase();
  const [forks, setForks] = useState<ScrimForkMarker[]>([]);
  const [files, setFiles] = useState<Record<string, string>>({});

  useEffect(() => {
    getForks(DEMO_RECORDING_ID)
      .then((stored) =>
        setForks(stored.map((f) => ({ id: f.id, timestamp: f.timestamp })))
      )
      .catch(console.error);
  }, []);

  const handleCreateFork = useCallback(
    async (draft: ScrimForkDraft): Promise<ScrimForkMarker> => {
      const fork = await createFork({
        recordingId: DEMO_RECORDING_ID,
        timestamp: draft.timestamp,
        content: draft.content,
        language: draft.language,
        cursor: draft.cursor,
        files: draft.files,
        activePath: draft.activePath ?? undefined,
      });
      const marker: ScrimForkMarker = {
        id: fork.id,
        timestamp: fork.timestamp,
      };
      setForks((prev) =>
        [...prev, marker].sort((a, b) => a.timestamp - b.timestamp)
      );
      return marker;
    },
    []
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

  const handleFilesChange = useCallback(
    (f: PlayerFiles) => setFiles(f.files),
    []
  );

  return (
    <section
      className="py-0"
      style={{
        paddingLeft: 'var(--content-offset)',
        paddingRight: 'var(--content-offset)',
      }}
    >
      {/* <div className="text-center mb-10">
        <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground mb-4">
          See it in action
        </h2>
        <p className="text-muted-foreground text-base sm:text-lg max-w-2xl mx-auto">
          A real recorded session, playing live. Hit Fork at any point to
          branch the code yourself — no sign-up required.
        </p>
      </div> */}

      <div className="rounded-xl overflow-hidden border border-border shadow-xl">
        <PlaygroundPlaybackShell
          className="h-[558px]"
          title="Live demo"
          showSidebarBrand={Object.keys(files).length > 1}
          actions={
            <Link
              href="/editor"
              className="flex items-center gap-1.5 px-3 py-1 rounded text-[11px] font-bold tracking-wider text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              title="Open the full playground"
            >
              OPEN EDITOR
            </Link>
          }
        >
          <ScrimPlayer
            src="/Demo.scrim"
            autoplay
            height="100%"
            theme={themeBase}
            sidebarWidth="16rem"
            renderFileIcon={(name) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={getMaterialFileIcon(name)}
                alt={name}
                width={18}
                height={18}
                style={{ opacity: 0.9 }}
              />
            )}
            forks={forks}
            onCreateFork={handleCreateFork}
            onSaveFork={handleSaveFork}
            onOpenFork={handleOpenFork}
            onDeleteFork={handleDeleteFork}
            onFilesChange={handleFilesChange}
            style={{ border: 'none', borderRadius: 0, boxShadow: 'none' }}
          />
        </PlaygroundPlaybackShell>
      </div>
    </section>
  );
}
