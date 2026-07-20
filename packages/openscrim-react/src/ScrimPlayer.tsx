import {
  type CSSProperties,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
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
import { buildFileTree, languageForPath } from './file-tree.js';
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

interface CursorPos {
  lineNumber: number;
  column: number;
}

/** A fork's position on the timeline — the minimum the player needs to render it. */
export interface ScrimForkMarker {
  id: string;
  timestamp: number;
  label?: string;
}

/** Snapshot captured when the viewer creates a fork; persist and return a marker. */
export interface ScrimForkDraft {
  timestamp: number;
  content: string;
  language: string;
  cursor: CursorPos;
  files: Record<string, string>;
  activePath: string | null;
}

/** Debounced edits to an open fork. */
export interface ScrimForkEdits {
  content: string;
  cursor: CursorPos;
  files: Record<string, string>;
  activePath: string | null;
}

/** Stored fork content the player loads when a fork is opened. */
export interface ScrimForkContent {
  content: string;
  language?: string;
  cursor?: CursorPos;
  files?: Record<string, string>;
  activePath?: string | null;
}

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
  /** Allow editing while paused (ignored when fork callbacks are provided). Default true. */
  editWhilePaused?: boolean;
  controls?: boolean;
  pointer?: boolean;
  /** Show the file sidebar. Default: auto (on when the recording has >1 file). */
  sidebar?: boolean;
  /** Sidebar width (any CSS size). Default 220px. */
  sidebarWidth?: string | number;
  /** Custom icon per file in the tree (e.g. material file-type icons). */
  renderFileIcon?: (name: string) => ReactNode;

  // --- Forking (all optional; storage stays with you) ---
  /** Existing forks to render as scrubber markers. */
  forks?: ScrimForkMarker[];
  /** Persist a new fork captured at the current time; return its marker (with id). */
  onCreateFork?: (draft: ScrimForkDraft) => ScrimForkMarker | Promise<ScrimForkMarker>;
  /** Persist edits to the open fork (debounced while editing). */
  onSaveFork?: (id: string, edits: ScrimForkEdits) => void;
  /** Load an existing fork's stored content. */
  onOpenFork?: (id: string) => ScrimForkContent | Promise<ScrimForkContent>;
  /** Remove a fork. */
  onDeleteFork?: (id: string) => void;

  /** Render a live preview pane; receives the reconstructed file contents. */
  renderPreview?: (files: PlayerFiles) => ReactNode;
  /** Fires with the reconstructed file contents as playback/forking mutate them. */
  onFilesChange?: (files: PlayerFiles) => void;
  /** Fires when the player enters/leaves fork (editable) mode. */
  onForkModeChange?: (forking: boolean) => void;
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
 * Batteries-included, themeable playback surface: file sidebar, tabs, a Monaco
 * editor that replays the recording, a transport bar, and a pointer overlay.
 * When fork callbacks are supplied, viewers can branch the instructor's code
 * at any point — the player owns the fork *mode* and UI; you own persistence.
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
    sidebarWidth,
    renderFileIcon,
    forks = [],
    onCreateFork,
    onSaveFork,
    onOpenFork,
    onDeleteFork,
    renderPreview,
    onFilesChange,
    onForkModeChange,
    children,
    className,
    style,
  } = props;

  const forkEnabled = !!onCreateFork;

  useEffect(() => {
    if (typeof document !== 'undefined') injectStyles(document);
  }, []);
  const resolved = resolveTheme(theme);
  const rootStyle = {
    ...resolved.vars,
    height,
    ...(sidebarWidth != null
      ? {
          '--os-sidebar-width':
            typeof sidebarWidth === 'number' ? `${sidebarWidth}px` : sidebarWidth,
        }
      : {}),
    ...style,
  } as CSSProperties;

  const { session, error } = useResolvedSession(props);
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [seenFiles, setSeenFiles] = useState<string[]>([]);
  const [files, setFiles] = useState<Record<string, string>>({});
  const [dot, setDot] = useState<MousePointerEvent | null>(null);
  const [forkMode, setForkMode] = useState(false);
  const [activeForkId, setActiveForkId] = useState<string | null>(null);
  const [showForkList, setShowForkList] = useState(false);

  // Refs for event handlers / timers that must read the latest value.
  const activeFileRef = useRef<string | null>(null);
  const filesRef = useRef<Record<string, string>>({});
  const activeForkIdRef = useRef<string | null>(null);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const forkListRef = useRef<HTMLDivElement>(null);
  activeFileRef.current = activeFile;
  filesRef.current = files;
  activeForkIdRef.current = activeForkId;

  const onSaveForkRef = useRef(onSaveFork);
  const onOpenForkRef = useRef(onOpenFork);
  const onFilesChangeRef = useRef(onFilesChange);
  const onForkModeChangeRef = useRef(onForkModeChange);
  onSaveForkRef.current = onSaveFork;
  onOpenForkRef.current = onOpenFork;
  onFilesChangeRef.current = onFilesChange;
  onForkModeChangeRef.current = onForkModeChange;

  // Reset per-recording view state and seed the file store with the snapshot.
  useEffect(() => {
    setActiveFile(null);
    setSeenFiles([]);
    setDot(null);
    setForkMode(false);
    setActiveForkId(null);
    setFiles(session?.files ? { ...session.files } : {});
  }, [session]);

  useEffect(() => {
    onFilesChangeRef.current?.({ files, activeFile });
  }, [files, activeFile]);
  useEffect(() => {
    onForkModeChangeRef.current?.(forkMode);
  }, [forkMode]);

  const player = usePlayer({
    session,
    autoplay,
    speed,
    // The component owns readOnly (fork mode / edit-while-paused), so the hook
    // must not toggle it on pause.
    editWhilePaused: false,
    onPointer: pointer ? setDot : undefined,
    onFileChange: (event) => {
      if (forkMode) return; // playback is paused during a fork
      // Imperative — onContentRendered fires in the same burst, before the
      // re-render syncs activeFileRef, so content lands on the right file.
      activeFileRef.current = event.path;
      setActiveFile(event.path);
      setSeenFiles((prev) => (prev.includes(event.path) ? prev : [...prev, event.path]));
      if (event.content !== undefined) {
        const content = event.content;
        setFiles((prev) => ({ ...prev, [event.path]: content }));
      }
    },
    onContentRendered: (content) => {
      const path = activeFileRef.current;
      if (path) setFiles((prev) => ({ ...prev, [path]: content }));
    },
  });
  const { position, state, isPlaying, play, pause, seek, setSpeed } = player;

  /**
   * PlaybackEngine's `reset` event (emitted synchronously at the start of
   * every seek) carries only content/language — no file path — so it can't
   * tell us which file it belongs to. We resolve it ourselves by scanning for
   * the last FILE_CHANGE at/before the target time, and set the ref *before*
   * seeking so the reset's onContentRendered call lands in the right bucket
   * instead of clobbering whatever file was active before the seek.
   */
  const syncActiveFileForTime = (timeMs: number) => {
    if (!session) return;
    const t0 = session.events[0]?.timestamp ?? 0;
    const target = t0 + timeMs;
    let path: string | null = null;
    for (const ev of session.events) {
      if (ev.timestamp > target) break;
      if (ev.type === RecordingEventType.FILE_CHANGE) {
        path = (ev as FileChangeEvent).path;
      }
    }
    if (path) {
      activeFileRef.current = path;
      setActiveFile(path);
      setSeenFiles((prev) => (prev.includes(path!) ? prev : [...prev, path!]));
    }
  };

  const seekTo = (timeMs: number) => {
    syncActiveFileForTime(timeMs);
    seek(timeMs);
  };

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
  const editable = forkEnabled ? forkMode : editWhilePaused && state !== PlaybackState.PLAYING;

  /** Latest content for a file: live store, else its first recorded snapshot. */
  const contentForFile = (path: string): string => {
    const known = filesRef.current[path];
    if (known !== undefined) return known;
    const first = session?.events.find(
      (e) => e.type === RecordingEventType.FILE_CHANGE && (e as FileChangeEvent).path === path
    ) as FileChangeEvent | undefined;
    return first?.content ?? '';
  };

  const selectFile = (path: string) => {
    if (forkMode) {
      const editor = player.getEditor();
      const model = editor?.getModel();
      if (!editor || !model || path === activeFileRef.current) return;
      activeFileRef.current = path;
      setActiveFile(path);
      setSeenFiles((prev) => (prev.includes(path) ? prev : [...prev, path]));
      model.setValue(contentForFile(path));
      player.getMonaco()?.editor.setModelLanguage(model, languageForPath(path));
      return;
    }
    const at = firstAppearance.get(path);
    if (at !== undefined) seekTo(at);
  };

  const handleCreateFork = async () => {
    const editor = player.getEditor();
    if (!editor || !onCreateFork || forkMode) return;
    pause();
    const model = editor.getModel();
    const cur = editor.getPosition();
    const draft: ScrimForkDraft = {
      timestamp: position.currentTime,
      content: model?.getValue() ?? session?.initialContent ?? '',
      language: model?.getLanguageId() ?? session?.language ?? 'plaintext',
      cursor: cur ? { lineNumber: cur.lineNumber, column: cur.column } : { lineNumber: 1, column: 1 },
      files: { ...filesRef.current },
      activePath: activeFileRef.current,
    };
    try {
      const marker = await onCreateFork(draft);
      setActiveForkId(marker.id);
      setForkMode(true);
    } catch (err) {
      props.onError?.(err as Error);
    }
  };

  const handleOpenFork = async (id: string) => {
    if (forkMode) return;
    pause();
    setShowForkList(false);
    const editor = player.getEditor();
    if (!editor) return;
    try {
      const loaded = (await onOpenForkRef.current?.(id)) ?? null;
      if (!loaded) return;
      setActiveForkId(id);
      setForkMode(true);
      if (loaded.files) setFiles((prev) => ({ ...prev, ...loaded.files }));
      const path = loaded.activePath ?? activeFileRef.current;
      if (path) {
        activeFileRef.current = path;
        setActiveFile(path);
        setSeenFiles((prev) => (prev.includes(path) ? prev : [...prev, path]));
      }
      const model = editor.getModel();
      if (model) {
        model.setValue(loaded.content);
        if (path) player.getMonaco()?.editor.setModelLanguage(model, languageForPath(path));
      }
      if (loaded.cursor) editor.setPosition(loaded.cursor);
    } catch (err) {
      props.onError?.(err as Error);
    }
  };

  const flushForkSave = () => {
    const id = activeForkIdRef.current;
    const editor = player.getEditor();
    const model = editor?.getModel();
    if (!id || !model) return;
    const cur = editor?.getPosition();
    onSaveForkRef.current?.(id, {
      content: model.getValue(),
      cursor: cur ? { lineNumber: cur.lineNumber, column: cur.column } : { lineNumber: 1, column: 1 },
      files: { ...filesRef.current },
      activePath: activeFileRef.current,
    });
  };

  const returnToPlayback = () => {
    flushForkSave();
    const marker = forks.find((f) => f.id === activeForkIdRef.current);
    setForkMode(false);
    setActiveForkId(null);
    if (marker) {
      syncActiveFileForTime(marker.timestamp);
      const engine = player.getEngine();
      engine.seek(marker.timestamp);
      engine.play();
    }
  };

  const handleTogglePlay = () => {
    if (forkMode) return returnToPlayback();
    if (isPlaying) {
      pause();
    } else {
      // play() re-seeks to the current position internally (to restore
      // canonical content over any paused-edit), which also emits a reset.
      syncActiveFileForTime(position.currentTime);
      play();
    }
  };

  const handleDeleteFork = (id: string) => {
    onDeleteFork?.(id);
    if (activeForkIdRef.current === id) {
      setForkMode(false);
      setActiveForkId(null);
    }
  };

  // Debounced autosave of fork edits (+ live preview store updates).
  useEffect(() => {
    if (!forkMode || !activeForkId) return;
    const editor = player.getEditor();
    if (!editor) return;
    const disposable = editor.onDidChangeModelContent(() => {
      const path = activeFileRef.current;
      const model = editor.getModel();
      if (path && model) {
        const content = model.getValue();
        setFiles((prev) => ({ ...prev, [path]: content }));
      }
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = setTimeout(flushForkSave, 1500);
    });
    return () => {
      disposable.dispose();
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
    // player.getEditor() is read at run time; deps intentionally minimal.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [forkMode, activeForkId]);

  // Close the fork list on outside click.
  useEffect(() => {
    if (!showForkList) return;
    const close = (e: MouseEvent) => {
      if (!forkListRef.current?.contains(e.target as Node)) setShowForkList(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [showForkList]);

  if (error) {
    return (
      <div className={`openscrim ${className ?? ''}`} data-theme={resolved.base} style={rootStyle}>
        <div className="os-error">Could not load recording: {error.message}</div>
      </div>
    );
  }

  const pct = position.progress * 100;

  return (
    <div
      className={`openscrim ${className ?? ''}`}
      data-theme={resolved.base}
      style={rootStyle}
    >
      <div className="os-body">
        {showSidebar && (
          <div className="os-sidebar">
            <div className="os-sidebar-title">Files</div>
            <FileTree
              nodes={treeNodes}
              activeFile={activeFile}
              onSelectFile={selectFile}
              renderIcon={renderFileIcon ? (name) => renderFileIcon(name) : undefined}
            />
          </div>
        )}

        <div className="os-main">
          {tabs.length > 0 && (
            <div className="os-tabs">
              {tabs.map((path) => (
                <div key={path} className="os-tab" data-active={path === activeFile} onClick={() => selectFile(path)}>
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
                readOnly: !editable,
                minimap: { enabled: false },
                automaticLayout: true,
                scrollBeyondLastLine: false,
              }}
            />
          </div>
        </div>

        {renderPreview && (
          <div style={{ flex: '1 1 40%', minWidth: 0, borderLeft: '1px solid var(--os-border)' }}>
            {renderPreview({ files, activeFile })}
          </div>
        )}
      </div>

      {/* Pointer overlays the full player root — recordings normalize the cursor
          to the whole IDE area (full height, matching a floating control bar),
          not the body minus the docked controls. */}
      {pointer && dot && !forkMode && (
        <div aria-hidden className="os-pointer" style={{ left: `${dot.x * 100}%`, top: `${dot.y * 100}%` }} />
      )}

      {controls && !children && (
        <div className="os-controls">
          <button
            type="button"
            className="os-btn os-btn-primary os-btn-round"
            onClick={handleTogglePlay}
            aria-label={forkMode ? 'Return to playback' : isPlaying ? 'Pause' : 'Play'}
            title={forkMode ? 'Return to playback' : undefined}
          >
            {isPlaying && !forkMode ? <PauseIcon /> : <PlayIcon />}
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
              disabled={forkMode}
              onChange={(e) => seekTo((Number(e.target.value) / 1000) * position.totalTime)}
              style={{ background: `linear-gradient(to right, var(--os-accent) ${pct}%, var(--os-border) ${pct}%)` }}
              aria-label="Seek"
            />
            {position.totalTime > 0 &&
              forks.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  className="os-fork-marker"
                  style={{ left: `${(f.timestamp / position.totalTime) * 100}%` }}
                  title={f.label ?? `Fork at ${formatTime(f.timestamp)}`}
                  onClick={() => handleOpenFork(f.id)}
                />
              ))}
          </div>
          <select
            className="os-select"
            defaultValue="1"
            disabled={forkMode}
            onChange={(e) => setSpeed(Number(e.target.value))}
            aria-label="Playback speed"
          >
            <option value="0.5">0.5×</option>
            <option value="1">1×</option>
            <option value="1.5">1.5×</option>
            <option value="2">2×</option>
          </select>

          {forkEnabled && (
            <div ref={forkListRef} style={{ position: 'relative', display: 'flex' }}>
              <button
                type="button"
                className="os-btn"
                onClick={handleCreateFork}
                disabled={forkMode}
                title="Pause and edit the code at this point"
              >
                ⑂ Fork{forks.length > 0 ? ` (${forks.length})` : ''}
              </button>
              {forks.length > 0 && (
                <button
                  type="button"
                  className="os-btn"
                  onClick={() => setShowForkList((v) => !v)}
                  aria-label="Show forks"
                  style={{ minWidth: 24, padding: '0 6px' }}
                >
                  ▾
                </button>
              )}
              {showForkList && (
                <div
                  style={{
                    position: 'absolute',
                    bottom: '100%',
                    right: 0,
                    marginBottom: 6,
                    minWidth: 200,
                    background: 'var(--os-surface)',
                    border: '1px solid var(--os-border)',
                    borderRadius: 8,
                    boxShadow: '0 6px 20px rgba(0,0,0,0.35)',
                    maxHeight: 220,
                    overflowY: 'auto',
                    zIndex: 20,
                  }}
                >
                  {forks.map((f, i) => (
                    <div key={f.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '6px 10px', borderBottom: '1px solid var(--os-border)' }}>
                      <span style={{ fontSize: 12 }}>
                        {f.label ?? `Fork #${i + 1}`}{' '}
                        <span className="os-time">{formatTime(f.timestamp)}</span>
                      </span>
                      <span style={{ display: 'flex', gap: 4 }}>
                        <button type="button" className="os-btn" style={{ height: 22, fontSize: 11 }} onClick={() => handleOpenFork(f.id)}>Open</button>
                        {onDeleteFork && (
                          <button type="button" className="os-btn" style={{ height: 22, fontSize: 11 }} onClick={() => handleDeleteFork(f.id)}>Delete</button>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {forkMode ? (
            <span className="os-hint">forking — edit freely, ▶ to resume</span>
          ) : (
            editable && <span className="os-hint">edit freely — play to resume</span>
          )}
        </div>
      )}

      {children?.(player)}
    </div>
  );
}
