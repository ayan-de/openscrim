'use client';

import { useState, useEffect, useRef } from 'react';
import { Editor } from '@monaco-editor/react';
import type * as monacoType from 'monaco-editor';
import { PlaybackEngine, PlaybackState } from '@thisisayande/openscrim-core';
import type {
  PlaybackPosition,
  PlaybackEventHandler,
  RecordingSession,
} from '@thisisayande/openscrim-core';
import { attachPlayback } from '@thisisayande/openscrim-monaco';
import type { PlaybackAttachment } from '@thisisayande/openscrim-monaco';
import { GitBranch } from 'lucide-react';
import type { Fork, ViewerMode } from '@/lib/forkTypes';
import {
  createFork,
  getForks,
  getFork,
  updateForkEdits,
  deleteFork as deleteForkFromStorage,
} from '@/lib/forkStorage';
import { BrandMark, SidebarBrandBackdrop } from '@/components/BrandBackdrop';

interface PlaybackViewerProps {
  session: RecordingSession | null;
  onClose?: () => void;
}

export default function PlaybackViewer({
  session,
  onClose,
}: PlaybackViewerProps): React.JSX.Element {
  const [playbackState, setPlaybackState] = useState<PlaybackState>(
    PlaybackState.IDLE
  );
  const [position, setPosition] = useState<PlaybackPosition>({
    currentTime: 0,
    totalTime: 0,
    currentEventIndex: 0,
    progress: 0,
  });
  const [speed, setSpeed] = useState<number>(1);
  const [editorContent, setEditorContent] = useState<string>('');
  const [isReady, setIsReady] = useState<boolean>(false);

  const [mode, setMode] = useState<ViewerMode>('playback');
  const [activeForkId, setActiveForkId] = useState<string | null>(null);
  const [forks, setForks] = useState<Fork[]>([]);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeForkIdRef = useRef<string | null>(null);
  const [showForkList, setShowForkList] = useState<boolean>(false);
  const forkListRef = useRef<HTMLDivElement>(null);

  const engineRef = useRef<PlaybackEngine | null>(null);
  const editorRef = useRef<monacoType.editor.IStandaloneCodeEditor | null>(
    null
  );
  const monacoRef = useRef<typeof monacoType | null>(null);
  const attachmentRef = useRef<PlaybackAttachment | null>(null);

  useEffect(() => {
    activeForkIdRef.current = activeForkId;
  }, [activeForkId]);

  useEffect(() => {
    if (!engineRef.current) {
      engineRef.current = new PlaybackEngine();
    }

    const engine = engineRef.current;

    const eventHandler: PlaybackEventHandler = ({ type, data }) => {
      switch (type) {
        case 'stateChange':
          setPlaybackState(data.state);
          break;

        case 'positionUpdate':
          setPosition(data);
          break;

        case 'error':
          console.error('Playback error:', data);
          break;
      }
    };

    engine.addEventHandler(eventHandler);

    return () => {
      attachmentRef.current?.detach();
      attachmentRef.current = null;
      engine.removeEventHandler(eventHandler);
      engine.destroy();
    };
  }, []);

  useEffect(() => {
    if (session && engineRef.current) {
      engineRef.current.loadSession(session);
      setEditorContent(session.initialContent);
      setIsReady(true);
    } else {
      setIsReady(false);
      setEditorContent('');
    }
  }, [session]);

  useEffect(() => {
    if (session) {
      getForks(session.id).then(setForks).catch(console.error);
    } else {
      setForks([]);
    }
    setMode('playback');
    setActiveForkId(null);
  }, [session]);

  useEffect(() => {
    if (!showForkList) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        forkListRef.current &&
        !forkListRef.current.contains(e.target as Node)
      ) {
        setShowForkList(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showForkList]);

  const handleEditorMount = (
    editor: monacoType.editor.IStandaloneCodeEditor,
    monaco: typeof monacoType
  ) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    editor.updateOptions({ readOnly: true });

    if (engineRef.current) {
      attachmentRef.current?.detach();
      attachmentRef.current = attachPlayback(
        editor,
        monaco,
        engineRef.current,
        {
          onContentRendered: setEditorContent,
        }
      );
    }
  };

  const handlePlay = () => {
    engineRef.current?.play();
  };

  const handlePause = () => {
    engineRef.current?.pause();
  };

  const handleStop = () => {
    engineRef.current?.stop();
  };

  const handleSeek = (timeMs: number) => {
    engineRef.current?.seek(timeMs);
  };

  const handleSpeedChange = (newSpeed: number) => {
    setSpeed(newSpeed);
    engineRef.current?.setSpeed(newSpeed);
  };

  const handleTimelineChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const progress = parseFloat(e.target.value);
    const timeMs = (progress * position.totalTime) / 100;
    handleSeek(timeMs);
  };

  const handleCreateFork = async () => {
    if (!session || !editorRef.current || mode === 'fork') return;
    const engine = engineRef.current;
    if (!engine) return;

    engine.pause();

    const pos = engine.getPosition();
    const editor = editorRef.current;
    const cursorPos = editor.getPosition();
    const content = editor.getModel()?.getValue() ?? session.initialContent;

    try {
      const fork = await createFork({
        recordingId: session.id,
        timestamp: pos.currentTime,
        content,
        language: session.language,
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
      setEditorContent(content);

      editor.updateOptions({ readOnly: false });
    } catch (error) {
      console.error('Failed to create fork:', error);
    }
  };

  useEffect(() => {
    if (mode !== 'fork' || !activeForkId || !editorRef.current) return;

    const editor = editorRef.current;
    const disposable = editor.onDidChangeModelContent(() => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
      autoSaveTimerRef.current = setTimeout(() => {
        const currentForkId = activeForkIdRef.current;
        if (!currentForkId || !editorRef.current) return;
        const model = editorRef.current.getModel();
        if (!model) return;
        const cursorPos = editorRef.current.getPosition();
        updateForkEdits(
          currentForkId,
          model.getValue(),
          cursorPos
            ? { lineNumber: cursorPos.lineNumber, column: cursorPos.column }
            : { lineNumber: 1, column: 1 }
        ).catch(console.error);
      }, 2000);
    });

    return () => {
      disposable.dispose();
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [mode, activeForkId]);

  const handleReturnToPlayback = async () => {
    const forkId = activeForkIdRef.current;
    if (forkId && editorRef.current) {
      const model = editorRef.current.getModel();
      const cursorPos = editorRef.current.getPosition();
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

    editorRef.current?.updateOptions({ readOnly: true });
    setMode('playback');
    setActiveForkId(null);
    activeForkIdRef.current = null;

    const engine = engineRef.current;
    if (engine && session) {
      const fork = forks.find((f) => f.id === forkId);
      if (fork) {
        engine.seek(fork.timestamp);
      }
      engine.play();
    }
  };

  const handleOpenFork = async (fork: Fork) => {
    if (mode === 'fork') return;

    const engine = engineRef.current;
    if (engine) {
      engine.pause();
    }

    const latestFork = await getFork(fork.id);
    if (!latestFork) return;

    editorRef.current?.updateOptions({ readOnly: false });
    setActiveForkId(latestFork.id);
    activeForkIdRef.current = latestFork.id;
    setMode('fork');
    setEditorContent(latestFork.edits);

    if (editorRef.current) {
      editorRef.current.setPosition({
        lineNumber: latestFork.cursor.lineNumber,
        column: latestFork.cursor.column,
      });
    }
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

  const formatTime = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const speedOptions = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4];

  if (!session) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-900 text-white">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">No Recording Selected</h2>
          <p className="text-gray-400">
            Please select a recording session to view.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col bg-background text-foreground font-sans">
      <div className="flex items-center justify-between flex-shrink-0 h-[38px] px-4 bg-background border-b border-border shadow-sm z-10">
        <div className="relative flex items-center justify-between flex-grow min-w-0">
          <div className="flex items-center gap-2 text-[13px] min-w-0">
            <span className="text-muted-foreground font-medium">Player</span>
            <span className="text-muted-foreground font-light">/</span>
            <span className="font-semibold text-foreground tracking-wide truncate max-w-64">
              {session.title}
            </span>
            <span className="ml-2 px-2 py-0.5 rounded bg-accent text-accent-foreground text-[10px] font-bold uppercase tracking-widest">
              {playbackState.toUpperCase()}
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* Play/Pause/Stop */}
            <div className="flex items-center gap-1">
              {playbackState === PlaybackState.PLAYING ? (
                <button
                  onClick={handlePause}
                  className="px-2.5 py-1 bg-primary text-primary-foreground hover:bg-primary/90 rounded text-xs font-semibold transition-colors cursor-pointer"
                  disabled={!isReady || mode === 'fork'}
                >
                  Pause
                </button>
              ) : (
                <button
                  onClick={handlePlay}
                  className="px-2.5 py-1 bg-primary text-primary-foreground hover:bg-primary/90 rounded text-xs font-semibold transition-colors cursor-pointer"
                  disabled={!isReady || mode === 'fork'}
                >
                  Play
                </button>
              )}

              <button
                onClick={handleStop}
                className="px-2.5 py-1 bg-muted hover:bg-accent text-muted-foreground hover:text-accent-foreground rounded text-xs transition-colors cursor-pointer"
                disabled={!isReady || mode === 'fork'}
              >
                Stop
              </button>
            </div>

            {/* Time display */}
            <span className="font-mono text-xs text-muted-foreground">
              {formatTime(position.currentTime)} / {formatTime(position.totalTime)}
            </span>

            {/* Speed control */}
            <select
              value={speed}
              onChange={(e) => handleSpeedChange(parseFloat(e.target.value))}
              className="bg-card border border-border rounded px-2 py-0.5 text-xs text-foreground font-mono"
              disabled={!isReady || mode === 'fork'}
            >
              {speedOptions.map((option) => (
                <option key={option} value={option}>
                  {option}x
                </option>
              ))}
            </select>

            {/* Fork button & list */}
            <div className="relative flex items-center gap-1.5" ref={forkListRef}>
              <button
                onClick={handleCreateFork}
                disabled={!isReady || mode === 'fork'}
                className="flex items-center gap-1 px-2.5 py-1 bg-purple-600 hover:bg-purple-700 text-white disabled:opacity-50 rounded text-xs font-medium transition-colors cursor-pointer"
                title="Pause and edit code at this point"
              >
                <GitBranch size={12} />
                <span>Fork</span>
              </button>

              {forks.length > 0 && (
                <button
                  onClick={() => setShowForkList(!showForkList)}
                  disabled={mode === 'fork'}
                  className="px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground bg-muted hover:bg-accent rounded transition-colors disabled:opacity-50 cursor-pointer font-mono"
                >
                  {forks.length} fork{forks.length !== 1 ? 's' : ''}
                </button>
              )}

              {showForkList && (
                <div className="absolute top-full mt-2 right-0 w-72 bg-card border border-border rounded-lg shadow-xl z-50 max-h-64 overflow-y-auto p-1">
                  {forks.length === 0 ? (
                    <div className="p-3 text-xs text-muted-foreground text-center">
                      No forks yet — click Fork to start editing
                    </div>
                  ) : (
                    forks.map((fork, idx) => (
                      <div
                        key={fork.id}
                        className="flex items-center justify-between px-3 py-2 hover:bg-muted/50 rounded border-b border-border/50 last:border-b-0"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />
                          <span className="text-xs font-medium text-foreground truncate">
                            Fork #{idx + 1}
                          </span>
                          <span className="text-[10px] font-mono text-muted-foreground">
                            {formatTime(fork.timestamp)}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button
                            onClick={() => {
                              handleOpenFork(fork);
                              setShowForkList(false);
                            }}
                            disabled={mode === 'fork'}
                            className="px-2 py-0.5 text-[10px] bg-primary text-primary-foreground hover:bg-primary/90 rounded disabled:opacity-50 font-medium"
                          >
                            Open
                          </button>
                          <button
                            onClick={() => handleDeleteFork(fork.id)}
                            className="px-2 py-0.5 text-[10px] bg-destructive/20 hover:bg-destructive/40 text-destructive rounded font-medium"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {onClose && (
              <button
                onClick={onClose}
                className="px-2.5 py-1 bg-muted hover:bg-accent text-xs rounded transition-colors"
              >
                Close
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Playback Scrubber Strip */}
      <div className="px-4 py-1.5 bg-card border-b border-border flex items-center gap-3">
        <div className="flex-1 relative flex items-center">
          <input
            type="range"
            min="0"
            max="100"
            step="0.1"
            value={position.progress * 100}
            onChange={handleTimelineChange}
            className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer timeline-slider"
            disabled={!isReady || mode === 'fork'}
          />
          {position.totalTime > 0 &&
            forks.map((fork) => {
              const leftPercent = (fork.timestamp / position.totalTime) * 100;
              return (
                <button
                  key={fork.id}
                  onClick={() => handleOpenFork(fork)}
                  disabled={mode === 'fork'}
                  className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full border border-background transition-transform hover:scale-150 ${
                    mode === 'fork'
                      ? 'bg-muted-foreground cursor-not-allowed opacity-50'
                      : 'bg-primary hover:bg-primary/80 cursor-pointer'
                  }`}
                  style={{ left: `${leftPercent}%` }}
                  title={`Fork at ${formatTime(fork.timestamp)}`}
                />
              );
            })}
        </div>
      </div>

      {/* Fork mode banner */}
      {mode === 'fork' && (
        <div className="flex items-center justify-between px-4 py-2 bg-green-900/30 border-b border-green-700/50">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-sm text-green-300">
              Editing &bull; Fork at{' '}
              {formatTime(
                forks.find((f) => f.id === activeForkId)?.timestamp ?? 0
              )}
            </span>
          </div>
          <button
            onClick={handleReturnToPlayback}
            className="px-3 py-1 bg-green-600 hover:bg-green-700 rounded text-sm transition-colors"
          >
            Return to Playback
          </button>
        </div>
      )}

      <div className="flex flex-1 min-h-0">
        <div className="relative w-64 flex-shrink-0 overflow-hidden bg-sidebar border-r border-border">
          <SidebarBrandBackdrop />
          <div className="relative z-10 flex items-center h-[38px] px-4 select-none">
            <BrandMark />
          </div>
          {session.description ? (
            <p className="relative z-10 px-4 pt-2 text-xs text-sidebar-foreground/80 leading-relaxed">
              {session.description}
            </p>
          ) : null}
        </div>

        <div className="flex-1 relative min-w-0">
          {isReady ? (
            <div
              className={
                mode === 'fork' ? 'h-full border-l-2 border-green-500' : 'h-full'
              }
            >
              <Editor
                height="100%"
                language={session.language}
                value={editorContent}
                onMount={handleEditorMount}
                theme="vs-dark"
                options={{
                  readOnly: mode !== 'fork',
                  minimap: { enabled: true },
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                  fontSize: 14,
                  lineNumbers: 'on',
                  cursorStyle: 'line',
                  selectionHighlight: true,
                  occurrencesHighlight: 'singleFile',
                }}
              />
            </div>
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
                <p className="text-muted-foreground text-sm">Loading recording...</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* eslint-disable-next-line react/no-unknown-property */}
      <style jsx>{`
        .timeline-slider::-webkit-slider-thumb {
          appearance: none;
          height: 16px;
          width: 16px;
          border-radius: 50%;
          background: #3b82f6;
          cursor: pointer;
          border: 2px solid #1f2937;
        }

        .timeline-slider::-moz-range-thumb {
          height: 16px;
          width: 16px;
          border-radius: 50%;
          background: #3b82f6;
          cursor: pointer;
          border: 2px solid #1f2937;
        }
      `}</style>
    </div>
  );
}
