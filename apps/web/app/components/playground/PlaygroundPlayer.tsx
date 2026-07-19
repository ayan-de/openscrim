'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Editor } from '@monaco-editor/react';
import type * as monacoType from 'monaco-editor';
import { getMaterialFileIcon } from 'file-extension-icon-js';
import { GitBranch, Pause, Play, RotateCcw, X } from 'lucide-react';
import {
  PlaybackEngine,
  PlaybackState,
  RecordingEventType,
} from '@repo/openscrim-core';
import type {
  FileChangeEvent,
  PlaybackEventHandler,
  PlaybackPosition,
  RecordingSession,
} from '@repo/openscrim-core';
import { attachPlayback } from '@repo/openscrim-monaco';
import type { PlaybackAttachment } from '@repo/openscrim-monaco';
import { useAuth } from '@/hooks/useAuth';
import { useLoading } from '@/context/LoadingContext';
import { getRecordingStorage } from '@/lib/storage';
import { formatDuration } from '@/lib/formatDuration';
import type { Fork, ViewerMode } from '@/lib/forkTypes';
import {
  createFork,
  deleteFork as deleteForkFromStorage,
  getFork,
  getForks,
  updateForkEdits,
} from '@/lib/forkStorage';
import { displayPath } from '@/components/playground/fileStore';

interface PlaygroundPlayerProps {
  sessionId: string;
}

const SPEED_OPTIONS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4];

/**
 * Plays a recording back inside the playground IDE chrome: file sidebar and
 * tabs follow the recording's file_change events while a floating,
 * video-style control bar drives the PlaybackEngine. Fork pauses playback
 * and turns the editor editable, auto-saving edits like the /view player.
 */
export default function PlaygroundPlayer({ sessionId }: PlaygroundPlayerProps) {
  const { isAuthenticated } = useAuth();
  const { showError } = useLoading();

  const [session, setSession] = useState<RecordingSession | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [playbackState, setPlaybackState] = useState<PlaybackState>(
    PlaybackState.IDLE
  );
  const [position, setPosition] = useState<PlaybackPosition>({
    currentTime: 0,
    totalTime: 0,
    currentEventIndex: 0,
    progress: 0,
  });
  const [speed, setSpeed] = useState(1);
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [seenFiles, setSeenFiles] = useState<string[]>([]);

  const [mode, setMode] = useState<ViewerMode>('playback');
  const [forks, setForks] = useState<Fork[]>([]);
  const [activeForkId, setActiveForkId] = useState<string | null>(null);
  const [showForkList, setShowForkList] = useState(false);

  const engineRef = useRef<PlaybackEngine | null>(null);
  const editorRef = useRef<monacoType.editor.IStandaloneCodeEditor | null>(
    null
  );
  const attachmentRef = useRef<PlaybackAttachment | null>(null);
  const activeForkIdRef = useRef<string | null>(null);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const forkListRef = useRef<HTMLDivElement>(null);

  const isForking = mode === 'fork';

  useEffect(() => {
    activeForkIdRef.current = activeForkId;
  }, [activeForkId]);

  const ensureEngine = useCallback((): PlaybackEngine => {
    if (!engineRef.current) {
      engineRef.current = new PlaybackEngine();
    }
    return engineRef.current;
  }, []);

  // Engine lifecycle + UI state sync
  useEffect(() => {
    const engine = ensureEngine();

    const handler: PlaybackEventHandler = ({ type, data }) => {
      switch (type) {
        case 'stateChange':
          setPlaybackState(data.state);
          break;
        case 'positionUpdate':
          setPosition(data);
          break;
        case 'eventProcessed':
          if (data.type === 'fileChange') {
            const event = data.event as FileChangeEvent;
            setActiveFile(event.path);
            setSeenFiles((prev) =>
              prev.includes(event.path) ? prev : [...prev, event.path]
            );
          }
          break;
        case 'error':
          console.error('Playback error:', data);
          break;
      }
    };

    engine.addEventHandler(handler);
    return () => {
      attachmentRef.current?.detach();
      attachmentRef.current = null;
      engine.removeEventHandler(handler);
      engine.destroy();
      engineRef.current = null;
    };
  }, [ensureEngine]);

  // Load the recording + its forks
  useEffect(() => {
    let cancelled = false;
    const storage = getRecordingStorage(() => isAuthenticated);

    Promise.all([storage.load(sessionId), storage.getEvents(sessionId)])
      .then(([meta, events]) => {
        if (cancelled) return;
        if (!meta) {
          setLoadError('Recording not found');
          return;
        }
        const loaded = { ...meta, events };
        setSession(loaded);
        ensureEngine().loadSession(loaded);
      })
      .catch((err) => {
        console.error('Failed to load recording:', err);
        if (!cancelled) setLoadError('Failed to load recording');
      });

    getForks(sessionId)
      .then((f) => {
        if (!cancelled) setForks(f);
      })
      .catch(console.error);

    return () => {
      cancelled = true;
    };
  }, [sessionId, isAuthenticated, ensureEngine]);

  useEffect(() => {
    if (!showForkList) return;
    const close = (e: MouseEvent) => {
      if (!forkListRef.current?.contains(e.target as Node)) {
        setShowForkList(false);
      }
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [showForkList]);

  // Every file path the recording touches, in order of first appearance
  const recordedFiles = useMemo(() => {
    if (!session) return [];
    const paths: string[] = [];
    for (const event of session.events) {
      if (event.type === RecordingEventType.FILE_CHANGE) {
        const path = (event as FileChangeEvent).path;
        if (!paths.includes(path)) paths.push(path);
      }
    }
    return paths;
  }, [session]);

  const firstEventTime = session?.events[0]?.timestamp ?? 0;

  const handleEditorMount = (
    editor: monacoType.editor.IStandaloneCodeEditor,
    monaco: typeof monacoType
  ) => {
    editorRef.current = editor;
    editor.updateOptions({ readOnly: true });
    attachmentRef.current?.detach();
    attachmentRef.current = attachPlayback(editor, monaco, ensureEngine());
  };

  const handleTogglePlay = () => {
    const engine = ensureEngine();
    if (playbackState === PlaybackState.PLAYING) engine.pause();
    else engine.play();
  };

  const handleRestart = () => {
    ensureEngine().seek(0);
  };

  const handleTimelineChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const progress = parseFloat(e.target.value);
    ensureEngine().seek((progress * position.totalTime) / 100);
  };

  const handleSpeedChange = (newSpeed: number) => {
    setSpeed(newSpeed);
    ensureEngine().setSpeed(newSpeed);
  };

  /** Sidebar/tab click — jump to where the recording first shows this file. */
  const handleSeekToFile = (path: string) => {
    if (!session || isForking) return;
    const first = session.events.find(
      (e) =>
        e.type === RecordingEventType.FILE_CHANGE &&
        (e as FileChangeEvent).path === path
    );
    if (first) ensureEngine().seek(first.timestamp - firstEventTime);
  };

  const handleCreateFork = async () => {
    const engine = engineRef.current;
    const editor = editorRef.current;
    if (!session || !engine || !editor || isForking) return;

    engine.pause();
    const model = editor.getModel();
    const cursorPos = editor.getPosition();

    try {
      const fork = await createFork({
        recordingId: session.id,
        timestamp: engine.getPosition().currentTime,
        content: model?.getValue() ?? session.initialContent,
        language: model?.getLanguageId() ?? session.language,
        cursor: cursorPos
          ? { lineNumber: cursorPos.lineNumber, column: cursorPos.column }
          : { lineNumber: 1, column: 1 },
      });
      setForks((prev) =>
        [...prev, fork].sort((a, b) => a.timestamp - b.timestamp)
      );
      setActiveForkId(fork.id);
      activeForkIdRef.current = fork.id;
      setMode('fork');
      editor.updateOptions({ readOnly: false });
    } catch (error) {
      console.error('Failed to create fork:', error);
      showError('Failed to create fork');
    }
  };

  // Debounced auto-save of fork edits, mirroring the /view player
  useEffect(() => {
    if (!isForking || !activeForkId || !editorRef.current) return;

    const editor = editorRef.current;
    const disposable = editor.onDidChangeModelContent(() => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = setTimeout(() => {
        const forkId = activeForkIdRef.current;
        const model = editorRef.current?.getModel();
        if (!forkId || !model) return;
        const cursorPos = editorRef.current?.getPosition();
        updateForkEdits(
          forkId,
          model.getValue(),
          cursorPos
            ? { lineNumber: cursorPos.lineNumber, column: cursorPos.column }
            : { lineNumber: 1, column: 1 }
        ).catch(console.error);
      }, 2000);
    });

    return () => {
      disposable.dispose();
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, [isForking, activeForkId]);

  const handleReturnToPlayback = async () => {
    const forkId = activeForkIdRef.current;
    const editor = editorRef.current;
    if (forkId && editor) {
      const model = editor.getModel();
      const cursorPos = editor.getPosition();
      if (model) {
        try {
          await updateForkEdits(
            forkId,
            model.getValue(),
            cursorPos
              ? { lineNumber: cursorPos.lineNumber, column: cursorPos.column }
              : { lineNumber: 1, column: 1 }
          );
        } catch (error) {
          console.error('Failed to save fork edits:', error);
        }
      }
    }

    editor?.updateOptions({ readOnly: true });
    setMode('playback');
    setActiveForkId(null);
    activeForkIdRef.current = null;

    const engine = engineRef.current;
    const fork = forks.find((f) => f.id === forkId);
    if (engine && fork) {
      engine.seek(fork.timestamp);
      engine.play();
    }
  };

  const handleOpenFork = async (fork: Fork) => {
    if (isForking) return;
    engineRef.current?.pause();

    const latest = await getFork(fork.id);
    const editor = editorRef.current;
    if (!latest || !editor) return;

    editor.updateOptions({ readOnly: false });
    setActiveForkId(latest.id);
    activeForkIdRef.current = latest.id;
    setMode('fork');
    editor.getModel()?.setValue(latest.edits);
    editor.setPosition({
      lineNumber: latest.cursor.lineNumber,
      column: latest.cursor.column,
    });
  };

  const handleDeleteFork = async (forkId: string) => {
    try {
      await deleteForkFromStorage(forkId);
      setForks((prev) => prev.filter((f) => f.id !== forkId));
      if (activeForkId === forkId) {
        editorRef.current?.updateOptions({ readOnly: true });
        setMode('playback');
        setActiveForkId(null);
        activeForkIdRef.current = null;
      }
    } catch (error) {
      console.error('Failed to delete fork:', error);
    }
  };

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
          <Link
            href="/"
            className="font-bold select-none mr-2 flex items-center"
            title="OpenScrim"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="text-primary"
            >
              <path d="M12 2L2 7L12 12L22 7L12 2Z" fill="currentColor" />
              <path
                d="M2 17L12 22L22 17"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M2 12L12 17L22 12"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
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

        <Link
          href="/editor"
          className="flex items-center gap-1.5 px-3 py-1 rounded text-[11px] font-bold tracking-wider text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          title="Exit playback"
        >
          <X size={13} />
          EXIT
        </Link>
      </div>

      <div className="relative flex flex-row flex-grow min-h-0 bg-background">
        {/* Read-only file sidebar built from the recording's file events */}
        <div className="flex-shrink-0 w-64 border-r border-border bg-sidebar text-sidebar-foreground overflow-y-auto">
          <div className="text-xs px-4 pb-2 pt-4 font-semibold uppercase tracking-wider text-[11px] opacity-70">
            Files
          </div>
          {recordedFiles.length === 0 ? (
            <p className="px-4 text-xs text-sidebar-foreground/60">
              {session
                ? 'This recording has no file timeline.'
                : 'Loading recording…'}
            </p>
          ) : (
            <div className="text-sm">
              {recordedFiles.map((path) => {
                const name = path.split('/').pop() ?? path;
                return (
                  <div
                    key={path}
                    onClick={() => handleSeekToFile(path)}
                    title={`${displayPath(path)} — jump to first appearance`}
                    className={`py-1 mx-2 mb-0.5 px-2 rounded-md flex flex-row items-center gap-1.5 transition-colors ${
                      isForking
                        ? 'opacity-50'
                        : 'cursor-pointer hover:bg-sidebar-accent/50'
                    } ${
                      activeFile === path
                        ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium shadow-sm'
                        : 'text-sidebar-foreground/80'
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={getMaterialFileIcon(name)}
                      alt={name}
                      width={18}
                      height={18}
                    />
                    <p className="flex-grow overflow-hidden select-none text-ellipsis opacity-80">
                      {name}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Editor column */}
        <div className="flex-grow min-w-0 flex flex-col">
          {/* Tabs follow the recording as files appear */}
          <div className="flex items-center bg-background border-b border-border flex-shrink-0 overflow-x-auto">
            {(seenFiles.length > 0 ? seenFiles : activeFile ? [activeFile] : [])
              .filter(Boolean)
              .map((path) => {
                const name = path.split('/').pop() ?? path;
                const isActive = path === activeFile;
                return (
                  <div
                    key={path}
                    onClick={() => handleSeekToFile(path)}
                    title={displayPath(path)}
                    className={`flex items-center gap-2 px-3 py-2 text-sm border-r border-border select-none whitespace-nowrap transition-colors ${
                      isForking ? '' : 'cursor-pointer'
                    } ${
                      isActive
                        ? 'bg-background text-foreground shadow-[inset_0_-2px_0_0] shadow-primary'
                        : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={getMaterialFileIcon(name)}
                      alt={name}
                      width={16}
                      height={16}
                      className="opacity-90"
                    />
                    <span className="font-semibold tracking-wide text-[13px]">
                      {name}
                    </span>
                  </div>
                );
              })}
          </div>

          {/* Fork banner */}
          {isForking && (
            <div className="flex items-center justify-between px-4 py-1.5 bg-primary/10 border-b border-primary/30 flex-shrink-0">
              <div className="flex items-center gap-2 text-xs">
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                <span className="text-foreground">
                  Editing fork at{' '}
                  {formatDuration(
                    forks.find((f) => f.id === activeForkId)?.timestamp ?? 0,
                    'timer'
                  )}{' '}
                  — changes save automatically
                </span>
              </div>
              <button
                onClick={handleReturnToPlayback}
                className="px-3 py-1 rounded bg-primary text-primary-foreground text-xs font-bold tracking-wider hover:bg-primary/90 transition-colors cursor-pointer"
              >
                RETURN TO PLAYBACK
              </button>
            </div>
          )}

          {/* Monaco — driven by attachPlayback, editable only while forking */}
          <div
            className={`flex-grow min-h-0 bg-background ${
              isForking ? 'border-l-2 border-primary' : ''
            }`}
          >
            <Editor
              height="100%"
              defaultLanguage={session?.language}
              defaultValue={session?.initialContent ?? ''}
              onMount={handleEditorMount}
              theme="vs-dark"
              options={{
                readOnly: !isForking,
                minimap: { enabled: false },
                wordWrap: 'on',
                fontSize: 14,
                scrollBeyondLastLine: false,
                automaticLayout: true,
              }}
              className="pt-2"
            />
          </div>
        </div>

        {/* Floating video-style control bar */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-[min(760px,92%)] z-40">
          <div
            className={`flex items-center gap-3 rounded-xl border border-border bg-sidebar/95 backdrop-blur px-4 py-2.5 shadow-2xl transition-opacity ${
              isForking ? 'opacity-40 pointer-events-none' : 'opacity-100'
            }`}
          >
            <button
              onClick={handleTogglePlay}
              disabled={!session}
              className="flex items-center justify-center w-9 h-9 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-colors cursor-pointer disabled:opacity-50 flex-shrink-0"
              title={
                playbackState === PlaybackState.PLAYING ? 'Pause' : 'Play'
              }
            >
              {playbackState === PlaybackState.PLAYING ? (
                <Pause size={16} fill="currentColor" />
              ) : (
                <Play size={16} fill="currentColor" className="ml-0.5" />
              )}
            </button>
            <button
              onClick={handleRestart}
              disabled={!session}
              className="flex items-center justify-center w-7 h-7 rounded-full text-muted-foreground hover:text-foreground hover:bg-accent transition-colors cursor-pointer disabled:opacity-50 flex-shrink-0"
              title="Restart"
            >
              <RotateCcw size={14} />
            </button>

            <span className="text-xs font-mono text-muted-foreground whitespace-nowrap flex-shrink-0">
              {formatDuration(position.currentTime, 'timer')} /{' '}
              {formatDuration(position.totalTime, 'timer')}
            </span>

            {/* Scrubber with fork markers */}
            <div className="relative flex-grow min-w-0">
              <input
                type="range"
                min="0"
                max="100"
                step="0.1"
                value={position.progress * 100}
                onChange={handleTimelineChange}
                disabled={!session}
                className="w-full h-1.5 bg-border rounded-lg appearance-none cursor-pointer playground-scrubber"
              />
              {position.totalTime > 0 &&
                forks.map((fork) => (
                  <button
                    key={fork.id}
                    onClick={() => handleOpenFork(fork)}
                    className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-destructive border border-background hover:scale-150 transition-transform cursor-pointer"
                    style={{
                      left: `${(fork.timestamp / position.totalTime) * 100}%`,
                    }}
                    title={`Open fork at ${formatDuration(fork.timestamp, 'timer')}`}
                  />
                ))}
            </div>

            <select
              value={speed}
              onChange={(e) => handleSpeedChange(parseFloat(e.target.value))}
              disabled={!session}
              className="bg-transparent border border-border rounded px-1.5 py-0.5 text-xs text-muted-foreground hover:text-foreground cursor-pointer flex-shrink-0"
              title="Playback speed"
            >
              {SPEED_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}x
                </option>
              ))}
            </select>

            <div className="relative flex-shrink-0" ref={forkListRef}>
              <div className="flex items-center">
                <button
                  onClick={handleCreateFork}
                  disabled={!session}
                  className="flex items-center gap-1.5 pl-3 pr-2 py-1 rounded-l bg-accent text-accent-foreground text-[11px] font-bold tracking-wider hover:bg-accent/80 transition-colors cursor-pointer disabled:opacity-50"
                  title="Pause and edit the code at this point"
                >
                  <GitBranch size={12} />
                  FORK
                </button>
                <button
                  onClick={() => setShowForkList((v) => !v)}
                  disabled={forks.length === 0}
                  className="pl-1.5 pr-2 py-1 rounded-r bg-accent text-accent-foreground text-[11px] font-bold hover:bg-accent/80 transition-colors cursor-pointer disabled:opacity-50 border-l border-border"
                  title="Show forks"
                >
                  {forks.length}
                </button>
              </div>

              {showForkList && forks.length > 0 && (
                <div className="absolute bottom-full mb-2 right-0 w-72 bg-popover text-popover-foreground border border-border rounded-lg shadow-xl max-h-64 overflow-y-auto">
                  {forks.map((fork, idx) => (
                    <div
                      key={fork.id}
                      className="flex items-center justify-between px-3 py-2 hover:bg-accent/50 border-b border-border last:border-b-0"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-2 h-2 rounded-full bg-destructive flex-shrink-0" />
                        <span className="text-sm truncate">
                          Fork #{idx + 1}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatDuration(fork.timestamp, 'timer')}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          onClick={() => {
                            handleOpenFork(fork);
                            setShowForkList(false);
                          }}
                          className="px-2 py-0.5 text-xs rounded bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer"
                        >
                          Open
                        </button>
                        <button
                          onClick={() => handleDeleteFork(fork.id)}
                          className="px-2 py-0.5 text-xs rounded bg-destructive text-destructive-foreground hover:bg-destructive/90 cursor-pointer"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* eslint-disable-next-line react/no-unknown-property */}
      <style jsx>{`
        .playground-scrubber::-webkit-slider-thumb {
          appearance: none;
          height: 14px;
          width: 14px;
          border-radius: 50%;
          background: var(--primary);
          cursor: pointer;
        }
        .playground-scrubber::-moz-range-thumb {
          height: 14px;
          width: 14px;
          border-radius: 50%;
          background: var(--primary);
          cursor: pointer;
          border: 0;
        }
      `}</style>
    </div>
  );
}
