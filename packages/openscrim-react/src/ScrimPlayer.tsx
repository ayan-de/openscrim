import {
  type CSSProperties,
  type ReactNode,
  useEffect,
  useState,
} from 'react';
import { Editor } from '@monaco-editor/react';
import type * as monacoType from 'monaco-editor';
import {
  parseTantricaBytes,
  tantricaFileToSession,
  PlaybackState,
} from '@thisisayande/openscrim-core';
import type {
  MousePointerEvent,
  RecordingSession,
  TantricaFile,
} from '@thisisayande/openscrim-core';
import { usePlayer, type UsePlayerResult } from './usePlayer.js';

function formatTime(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export interface ScrimPlayerProps {
  /** Provide exactly one source: an in-memory session, a parsed file, or a URL. */
  session?: RecordingSession;
  file?: TantricaFile;
  /** URL of a `.tantrica` (or plain-JSON) recording to fetch. */
  src?: string;
  autoplay?: boolean;
  speed?: number;
  /** Monaco theme id (e.g. 'vs-dark', 'vs'). */
  theme?: string;
  height?: string | number;
  /** Allow editing the instructor's code while paused (fork). Default true. */
  editWhilePaused?: boolean;
  /** Render the built-in transport bar. Default true. */
  controls?: boolean;
  /** Render the recorded-pointer overlay dot. Default true. */
  pointer?: boolean;
  /** Full-control escape hatch: replace the default UI with your own. */
  children?: (player: UsePlayerResult) => ReactNode;
  onError?: (error: Error) => void;
  className?: string;
  style?: CSSProperties;
}

const barStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '8px 12px',
  fontFamily: 'system-ui, sans-serif',
  fontSize: 13,
  background: '#1e1e1e',
  color: '#ddd',
  borderTop: '1px solid #333',
};

function useResolvedSession(
  props: Pick<ScrimPlayerProps, 'session' | 'file' | 'src' | 'onError'>
): { session: RecordingSession | null; error: Error | null } {
  const { session: inline, file, src, onError } = props;
  const [session, setSession] = useState<RecordingSession | null>(
    inline ?? (file ? tantricaFileToSession(file) : null)
  );
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (inline) {
      setSession(inline);
      return;
    }
    if (file) {
      setSession(tantricaFileToSession(file));
      return;
    }
    if (!src) return;

    let cancelled = false;
    setSession(null);
    setError(null);
    fetch(src)
      .then(async (res) => {
        if (!res.ok) throw new Error(`Failed to fetch recording: HTTP ${res.status}`);
        const bytes = new Uint8Array(await res.arrayBuffer());
        return tantricaFileToSession(await parseTantricaBytes(bytes));
      })
      .then((resolved) => {
        if (!cancelled) setSession(resolved);
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setError(err);
        onError?.(err);
      });
    return () => {
      cancelled = true;
    };
  }, [inline, file, src, onError]);

  return { session, error };
}

/**
 * Batteries-included playback surface: a read-only Monaco editor that replays a
 * recording, with transport controls and a pointer overlay. Pause to let the
 * viewer edit (fork) the instructor's code; play to resume the canonical stream.
 */
export function ScrimPlayer(props: ScrimPlayerProps) {
  const {
    autoplay,
    speed,
    theme = 'vs-dark',
    height = '480px',
    editWhilePaused = true,
    controls = true,
    pointer = true,
    children,
    className,
    style,
  } = props;

  const { session, error } = useResolvedSession(props);
  const [dot, setDot] = useState<MousePointerEvent | null>(null);

  const player = usePlayer({
    session,
    autoplay,
    speed,
    editWhilePaused,
    onPointer: pointer ? setDot : undefined,
  });
  const { position, state, isPlaying, play, pause, seek, setSpeed } = player;

  if (error) {
    return (
      <div className={className} style={{ ...style, padding: 16, color: '#e06c75', fontFamily: 'system-ui' }}>
        Could not load recording: {error.message}
      </div>
    );
  }

  const paused = state !== PlaybackState.PLAYING;

  return (
    <div className={className} style={{ display: 'flex', flexDirection: 'column', ...style }}>
      <div style={{ position: 'relative', height, minHeight: 0 }}>
        <Editor
          // Uncontrolled + keyed per session: playback mutates the model
          // directly, so a controlled `value` would fight it on every re-render.
          key={session?.id ?? 'empty'}
          height="100%"
          theme={theme}
          defaultValue={session?.initialContent ?? ''}
          defaultLanguage={session?.language}
          onMount={(editor, monaco) =>
            player.onMount(editor, monaco as unknown as typeof monacoType)
          }
          options={{
            readOnly: true,
            minimap: { enabled: false },
            automaticLayout: true,
            scrollBeyondLastLine: false,
          }}
        />
        {pointer && dot && (
          <div
            aria-hidden
            style={{
              position: 'absolute',
              left: `${dot.x * 100}%`,
              top: `${dot.y * 100}%`,
              width: 12,
              height: 12,
              marginLeft: -6,
              marginTop: -6,
              borderRadius: '50%',
              background: 'rgba(255,80,80,0.85)',
              boxShadow: '0 0 8px rgba(255,80,80,0.6)',
              pointerEvents: 'none',
              transition: 'left 80ms linear, top 80ms linear',
            }}
          />
        )}
      </div>

      {controls && !children && (
        <div style={barStyle}>
          <button
            type="button"
            onClick={() => (isPlaying ? pause() : play())}
            style={{
              cursor: 'pointer',
              border: 'none',
              borderRadius: 4,
              padding: '4px 12px',
              fontSize: 14,
              color: '#fff',
              background: '#3a3a3a',
            }}
          >
            {isPlaying ? '⏸' : '▶'}
          </button>
          <span style={{ fontVariantNumeric: 'tabular-nums', color: '#aaa', minWidth: 92 }}>
            {formatTime(position.currentTime)} / {formatTime(position.totalTime)}
          </span>
          <input
            type="range"
            min={0}
            max={1000}
            value={Math.round(position.progress * 1000)}
            onChange={(e) => seek((Number(e.target.value) / 1000) * position.totalTime)}
            style={{ flex: 1, accentColor: '#e06c75' }}
            aria-label="Seek"
          />
          <select
            defaultValue="1"
            onChange={(e) => setSpeed(Number(e.target.value))}
            style={{ background: '#2a2a2a', color: '#ddd', border: '1px solid #444', borderRadius: 4, padding: '2px 4px' }}
            aria-label="Playback speed"
          >
            <option value="0.5">0.5×</option>
            <option value="1">1×</option>
            <option value="1.5">1.5×</option>
            <option value="2">2×</option>
          </select>
          {paused && editWhilePaused && (
            <span style={{ color: '#777', fontSize: 12 }}>edit freely — play to resume</span>
          )}
        </div>
      )}

      {children?.(player)}
    </div>
  );
}
