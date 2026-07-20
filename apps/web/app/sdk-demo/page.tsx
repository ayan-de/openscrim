'use client';

import { useRef, useState } from 'react';
import { ScrimRecorder, ScrimPlayer } from '@thisisayande/openscrim-react';
import type {
  RecordingSession,
  ScrimForkMarker,
  ScrimForkContent,
} from '@thisisayande/openscrim-react';

const labelStyle = {
  fontSize: 12,
  textTransform: 'uppercase' as const,
  letterSpacing: 1,
  color: '#888',
  margin: '0 0 8px',
};

/**
 * Throwaway proof that the published SDK's batteries-included components render
 * and round-trip end to end: record with <ScrimRecorder>, replay + fork in
 * <ScrimPlayer>. Forks are persisted to an in-memory Map here — the SDK never
 * touches storage itself, it just fires the callbacks.
 */
export default function SdkDemoPage() {
  const [session, setSession] = useState<RecordingSession | null>(null);
  const [forks, setForks] = useState<ScrimForkMarker[]>([]);
  const forkStore = useRef<Map<string, ScrimForkContent>>(new Map());

  return (
    <div
      style={{
        maxWidth: 900,
        margin: '0 auto',
        padding: 24,
        display: 'flex',
        flexDirection: 'column',
        gap: 24,
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <div>
        <h1 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>
          OpenScrim SDK demo
        </h1>
        <p style={{ color: '#666', fontSize: 14 }}>
          Renders the published <code>@thisisayande/openscrim-react</code>{' '}
          components directly. Record → Stop → replay. Hit{' '}
          <strong>Fork</strong> mid-playback to branch the code (persisted in an
          in-memory Map).
        </p>
      </div>

      <section>
        <p style={labelStyle}>1 · &lt;ScrimRecorder&gt;</p>
        <ScrimRecorder
          language="typescript"
          defaultValue={'// type something, then press Stop\nfunction hi() {\n  return 42;\n}\n'}
          title="SDK demo recording"
          height="320px"
          onComplete={(s) => {
            setForks([]);
            forkStore.current.clear();
            setSession(s);
          }}
        />
      </section>

      <section>
        <p style={labelStyle}>2 · &lt;ScrimPlayer&gt; (with forking)</p>
        {session ? (
          <ScrimPlayer
            session={session}
            autoplay
            height="320px"
            theme={{ accent: '#7c3aed' }}
            forks={forks}
            onCreateFork={(draft) => {
              const id =
                globalThis.crypto?.randomUUID?.() ?? `fork-${Date.now()}`;
              forkStore.current.set(id, {
                content: draft.content,
                language: draft.language,
                cursor: draft.cursor,
                files: draft.files,
                activePath: draft.activePath,
              });
              const marker: ScrimForkMarker = { id, timestamp: draft.timestamp };
              setForks((prev) => [...prev, marker]);
              return marker;
            }}
            onSaveFork={(id, edits) => {
              forkStore.current.set(id, {
                content: edits.content,
                cursor: edits.cursor,
                files: edits.files,
                activePath: edits.activePath,
              });
            }}
            onOpenFork={(id) => forkStore.current.get(id) ?? { content: '' }}
            onDeleteFork={(id) => {
              forkStore.current.delete(id);
              setForks((prev) => prev.filter((f) => f.id !== id));
            }}
          />
        ) : (
          <p style={{ color: '#999', fontSize: 14 }}>
            Record and stop above — the session appears here and autoplays.
          </p>
        )}
      </section>
    </div>
  );
}
