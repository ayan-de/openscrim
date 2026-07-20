import {
  type CSSProperties,
  type ReactNode,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Editor } from '@monaco-editor/react';
import type * as monacoType from 'monaco-editor';
import {
  parseTantricaBytes,
  tantricaFileToSession,
  PlaybackState,
  RecordingEventType,
} from '@thisisayande/openscrim-core';
import type {
  FileChangeEvent,
  MousePointerEvent,
  RecordingSession,
  TantricaFile,
} from '@thisisayande/openscrim-core';
import { usePlayer, type UsePlayerResult } from './usePlayer.js';
import { buildFileTree } from './file-tree.js';
import { FileTree } from './FileTree.js';
import { injectStyles, resolveTheme, type ThemeInput } from './styles.js';

function formatTime(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

const PlayIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M8 5v14l11-7z" />
  </svg>
);
const PauseIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M6 4h4v16H6zM14 4h4v16h-4z" />
  </svg>
);

/** Live file contents reconstructed from playback, for the preview slot. */
export interface PlayerFiles {
  files: Record<string, string>;
  activeFile: string | null;
}

export interface ScrimPlayerProps {
  /** Provide exactly one source: an in-memory session, a parsed file, or a URL. */
  session?: RecordingSession;
  file?: TantricaFile;
  src?: string;
  autoplay?: boolean;
  speed?: number;
  /** 'dark' | 'light' | a partial token override object. */
  theme?: ThemeInput;
  /** Override the Monaco theme id (defaults from `theme`'s base). */
  monacoTheme?: string;
  height?: string | number;
  /** Allow editing the instructor's code while paused. Default true. */
  editWhilePaused?: boolean;
  controls?: boolean;
  pointer?: boolean;
  /** Show the file sidebar. Default: auto (on when the recording has >1 file). */
  sidebar?: boolean;
  /** Render a live preview pane; receives the reconstructed file contents. */
  renderPreview?: (files: PlayerFiles) => ReactNode;
  /** Full-control escape hatch: replace the built-in transport with your own. */
  children?: (player: UsePlayerResult) => ReactNode;
  onError?: (error: Error) => void;
  className?: string;
  style?: CSSProperties;
}

function useResolvedSession(
  props: Pick<ScrimPlayerProps, 'session' | 'file' | 'src' | 'onError'>
): { session: RecordingSession | null; error: Error | null } {
  const { session: inline, file, src, onError } = props;
  const [session, setSession] = useState<RecordingSession | null>(
    inline ?? (file ? tantricaFileToSession(file) : null)
  );
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (inline) return setSession(inline);
    if (file) return setSession(tantricaFileToSession(file));
    if (!src) return;

    let cancelled = false;
    setSession(null);
    setError(null);
    fetch(src)
      .then(async (res) => {
        if (!res.ok) throw new Error(`Failed to fetch recording: HTTP ${res.status}`);
        return tantricaFileToSession(
          await parseTantricaBytes(new Uint8Array(await res.arrayBuffer()))
        );
      })
      .then((resolved) => !cancelled && setSession(resolved))
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
 * Batteries-included, themeable playback surface: a file sidebar, tabs, a
 * read-only Monaco editor that replays the recording, a transport bar, and a
 * pointer overlay. Multi-file recordings get a tree + tabs automatically; a
 * live preview can be slotted in via `renderPreview`.
 */
export function ScrimPlayer(props: ScrimPlayerProps) {
  const {
    autoplay,
    speed,
    theme,
    monacoTheme,
    height = '480px',
    editWhilePaused = true,
    controls = true,
    pointer = true,
    sidebar,
    renderPreview,
    children,
    className,
    style,
  } = props;

  useEffect(() => {
    if (typeof document !== 'undefined') injectStyles(document);
  }, []);
  const resolved = resolveTheme(theme);

  const { session, error } = useResolvedSession(props);
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [seenFiles, setSeenFiles] = useState<string[]>([]);
  const [files, setFiles] = useState<Record<string, string>>({});
  const [dot, setDot] = useState<MousePointerEvent | null>(null);

  // Reset per-recording view state and seed the file store with the snapshot.
  useEffect(() => {
    setActiveFile(null);
    setSeenFiles([]);
    setDot(null);
    setFiles(session?.files ? { ...session.files } : {});
  }, [session]);

  const player = usePlayer({
    session,
    autoplay,
    speed,
    editWhilePaused,
    onPointer: pointer ? setDot : undefined,
    onFileChange: (event) => {
      setActiveFile(event.path);
      setSeenFiles((prev) => (prev.includes(event.path) ? prev : [...prev, event.path]));
      if (event.content !== undefined) {
        const content = event.content;
        setFiles((prev) => ({ ...prev, [event.path]: content }));
      }
    },
    onContentRendered: (content) => {
      setActiveFile((path) => {
        if (path) setFiles((prev) => ({ ...prev, [path]: content }));
        return path;
      });
    },
  });
  const { position, state, isPlaying, play, pause, seek, setSpeed } = player;

  // First-appearance timestamps drive "click a file → jump there".
  const firstAppearance = useMemo(() => {
    const map = new Map<string, number>();
    const t0 = session?.events[0]?.timestamp ?? 0;
    for (const ev of session?.events ?? []) {
      if (ev.type === RecordingEventType.FILE_CHANGE) {
        const { path } = ev as FileChangeEvent;
        if (!map.has(path)) map.set(path, ev.timestamp - t0);
      }
    }
    return map;
  }, [session]);

  const allPaths = useMemo(() => {
    const set = new Set<string>([...Object.keys(session?.files ?? {}), ...seenFiles]);
    if (activeFile) set.add(activeFile);
    return [...set];
  }, [session, seenFiles, activeFile]);
  const treeNodes = useMemo(() => buildFileTree(allPaths), [allPaths]);

  const showSidebar = sidebar ?? allPaths.length > 1;
  const tabs = seenFiles.length > 0 ? seenFiles : activeFile ? [activeFile] : [];

  const selectFile = (path: string) => {
    const at = firstAppearance.get(path);
    if (at !== undefined) seek(at);
  };

  if (error) {
    return (
      <div className={`openscrim ${className ?? ''}`} data-theme={resolved.base} style={{ ...resolved.vars, ...style } as CSSProperties}>
        <div className="os-error">Could not load recording: {error.message}</div>
      </div>
    );
  }

  return (
    <div
      className={`openscrim ${className ?? ''}`}
      data-theme={resolved.base}
      style={{ ...resolved.vars, ...style } as CSSProperties}
    >
      <div className="os-body" style={{ height }}>
        {showSidebar && (
          <div className="os-sidebar">
            <div className="os-sidebar-title">Files</div>
            <FileTree nodes={treeNodes} activeFile={activeFile} onSelectFile={selectFile} />
          </div>
        )}

        <div className="os-main">
          {tabs.length > 0 && (
            <div className="os-tabs">
              {tabs.map((path) => (
                <div
                  key={path}
                  className="os-tab"
                  data-active={path === activeFile}
                  onClick={() => selectFile(path)}
                >
                  {path.split('/').pop()}
                </div>
              ))}
            </div>
          )}

          <div className="os-editor">
            <Editor
              key={session?.id ?? 'empty'}
              height="100%"
              theme={monacoTheme ?? resolved.monaco}
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
                className="os-pointer"
                style={{ left: `${dot.x * 100}%`, top: `${dot.y * 100}%` }}
              />
            )}
          </div>
        </div>

        {renderPreview && (
          <div style={{ flex: '1 1 40%', minWidth: 0, borderLeft: '1px solid var(--os-border)' }}>
            {renderPreview({ files, activeFile })}
          </div>
        )}
      </div>

      {controls && !children && (
        <div className="os-controls">
          <button
            type="button"
            className="os-btn os-btn-primary os-btn-round"
            onClick={() => (isPlaying ? pause() : play())}
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? <PauseIcon /> : <PlayIcon />}
          </button>
          <span className="os-time">
            {formatTime(position.currentTime)} / {formatTime(position.totalTime)}
          </span>
          <div className="os-seek-wrap">
            <input
              className="os-seek"
              type="range"
              min={0}
              max={1000}
              value={Math.round(position.progress * 1000)}
              onChange={(e) => seek((Number(e.target.value) / 1000) * position.totalTime)}
              // Fill the track up to the playhead — the sleek part browsers won't do.
              style={{
                background: `linear-gradient(to right, var(--os-accent) ${
                  position.progress * 100
                }%, var(--os-border) ${position.progress * 100}%)`,
              }}
              aria-label="Seek"
            />
          </div>
          <select
            className="os-select"
            defaultValue="1"
            onChange={(e) => setSpeed(Number(e.target.value))}
            aria-label="Playback speed"
          >
            <option value="0.5">0.5×</option>
            <option value="1">1×</option>
            <option value="1.5">1.5×</option>
            <option value="2">2×</option>
          </select>
          {state !== PlaybackState.PLAYING && editWhilePaused && (
            <span className="os-hint">edit freely — play to resume</span>
          )}
        </div>
      )}

      {children?.(player)}
    </div>
  );
}
