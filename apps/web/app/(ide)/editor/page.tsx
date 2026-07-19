'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Editor } from '@monaco-editor/react';
import type * as monacoType from 'monaco-editor';
import { FaCircle, FaPlay, FaStop } from 'react-icons/fa';
import { MonacoRecorder } from '@thisisayande/openscrim-monaco';
import { useAuth } from '@/hooks/useAuth';
import { useLoading } from '@/context/LoadingContext';
import { getRecordingStorage } from '@/lib/storage';
import { formatDuration } from '@/lib/formatDuration';
import type { RecordingSession } from '@thisisayande/openscrim-core';

import { getMaterialFileIcon } from 'file-extension-icon-js';
import FileExplorer from '@/components/playground/FileExplorer';
import FloatingPreviewWindow from '@/components/playground/FloatingPreviewWindow';
import PlaygroundPlayer from '@/components/playground/PlaygroundPlayer';
import TerminalPane from '@/components/playground/TerminalPane';
import PlaygroundModal from '@/components/playgroundCards/PlaygroundModal';

import {
  buildTree,
  createDir,
  createFile,
  deletePath,
  renamePath,
  starterFilesFor,
  updateFile,
} from '@/components/playground/fileStore';
import type {
  PlaygroundFiles,
  PlaygroundTemplate,
} from '@/components/playground/fileStore';

type SideMenuTab = 'about' | 'explorer' | 'settings';

export default function EditorPage() {
  return (
    <Suspense>
      <EditorPageContent />
    </Suspense>
  );
}

function EditorPageContent() {
  const params = useSearchParams();
  // ?play=<recordingId> swaps the playground for the playback view
  const playId = params.get('play');
  const template: PlaygroundTemplate =
    params.get('template') === 'react' ? 'react' : 'vanilla';
  if (playId) return <PlaygroundPlayer sessionId={playId} />;
  // Key forces a fresh playground when navigating between templates
  return <PlaygroundEditor key={template} template={template} />;
}

function PlaygroundEditor({ template }: { template: PlaygroundTemplate }) {
  const starter = starterFilesFor(template);
  const [store, setStore] = useState<PlaygroundFiles>(starter.store);
  const [openDirs, setOpenDirs] = useState<Set<string>>(
    new Set(starter.store.dirs)
  );
  const [openFiles, setOpenFiles] = useState<string[]>([starter.entryFile]);
  /** File opened by single click — shown as one italic tab that the next single click replaces */
  const [previewFile, setPreviewFile] = useState<string | null>(null);
  const [activeFile, setActiveFile] = useState<string | null>(
    starter.entryFile
  );

  const openTabs =
    previewFile && !openFiles.includes(previewFile)
      ? [...openFiles, previewFile]
      : openFiles;
  const [sideMenuSelectedTab] = useState<SideMenuTab>('explorer');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isTerminalOpen, setIsTerminalOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(true);

  const toggleSidebar = () => setIsSidebarOpen((open) => !open);
  const toggleTerminal = () => setIsTerminalOpen((open) => !open);
  const togglePreview = () => setIsPreviewOpen((open) => !open);

  const ideAreaRef = useRef<HTMLDivElement>(null);

  const [editorOptions, setEditorOptions] =
    useState<monacoType.editor.IStandaloneEditorConstructionOptions>({
      minimap: { enabled: false },
      wordWrap: 'on',
      lineNumbers: 'on',
      fontSize: 14,
      tabSize: 4,
    });

  const recorderRef = useRef<MonacoRecorder | null>(null);
  const recIntervalRef = useRef<NodeJS.Timeout | null>(null);
  /** Project files as they were when recording started — saved with the session */
  const filesAtRecordStartRef = useRef<Record<string, string>>({});
  const [isRecording, setIsRecording] = useState(false);
  const [recDuration, setRecDuration] = useState(0);
  const [showTitleModal, setShowTitleModal] = useState(false);

  // "Plays" dropdown — saved recordings, playable via /editor?play=<id>
  const [showPlays, setShowPlays] = useState(false);
  const [plays, setPlays] = useState<RecordingSession[]>([]);
  const [playsLoading, setPlaysLoading] = useState(false);
  const playsRef = useRef<HTMLDivElement>(null);

  const { isAuthenticated } = useAuth();
  const { showSuccess, showError } = useLoading();
  const storage = getRecordingStorage(() => isAuthenticated);

  useEffect(() => {
    return () => {
      if (recIntervalRef.current) clearInterval(recIntervalRef.current);
      recorderRef.current?.dispose();
    };
  }, []);

  // Track the author's mouse across the whole IDE while recording —
  // normalized to the IDE area so playback can overlay a pointer anywhere.
  useEffect(() => {
    if (!isRecording) return;
    const area = ideAreaRef.current;
    const manager = recorderRef.current?.getManager();
    if (!area || !manager) return;

    let pending: { x: number; y: number } | null = null;
    let flushTimer: ReturnType<typeof setTimeout> | null = null;

    const normalize = (e: MouseEvent) => {
      const rect = area.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return null;
      return {
        x: Math.min(Math.max((e.clientX - rect.left) / rect.width, 0), 1),
        y: Math.min(Math.max((e.clientY - rect.top) / rect.height, 0), 1),
      };
    };

    const onMove = (e: MouseEvent) => {
      pending = normalize(e);
      if (flushTimer) return;
      flushTimer = setTimeout(() => {
        flushTimer = null;
        if (pending) manager.recordPointer('move', pending.x, pending.y);
        pending = null;
      }, 80);
    };
    const onMouseDown = (e: MouseEvent) => {
      const p = normalize(e);
      if (p) manager.recordPointer('click', p.x, p.y);
    };

    document.addEventListener('mousemove', onMove);
    // Capture phase so clicks swallowed by Monaco/menus are still recorded
    document.addEventListener('mousedown', onMouseDown, true);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mousedown', onMouseDown, true);
      if (flushTimer) clearTimeout(flushTimer);
    };
  }, [isRecording]);

  // Fetch the recording list fresh each time the dropdown opens
  useEffect(() => {
    if (!showPlays) return;

    setPlaysLoading(true);
    getRecordingStorage(() => isAuthenticated)
      .list(1, 50)
      .then((result) => {
        setPlays(
          [...result.recordings].sort(
            (a, b) =>
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          )
        );
      })
      .catch((err) => console.error('Failed to load recordings:', err))
      .finally(() => setPlaysLoading(false));

    const close = (e: MouseEvent) => {
      if (!playsRef.current?.contains(e.target as Node)) setShowPlays(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [showPlays, isAuthenticated]);

  const handleEditorMount = (
    editor: monacoType.editor.IStandaloneCodeEditor,
    monaco: typeof monacoType
  ) => {
    recorderRef.current?.dispose();
    recorderRef.current = new MonacoRecorder(editor, monaco);
  };

  const startRecording = (title: string) => {
    const recorder = recorderRef.current;
    if (!recorder) {
      showError('Open a file first — the editor is not ready yet');
      return;
    }
    filesAtRecordStartRef.current = { ...store.files };
    recorder.start(title);
    setIsRecording(true);
    recIntervalRef.current = setInterval(() => {
      setRecDuration(recorder.getCurrentDuration());
    }, 100);
  };

  const handleToggleRecording = async () => {
    const recorder = recorderRef.current;
    if (!recorder) {
      showError('Open a file first — the editor is not ready yet');
      return;
    }

    if (!isRecording) {
      setShowTitleModal(true);
      return;
    }

    if (recIntervalRef.current) {
      clearInterval(recIntervalRef.current);
      recIntervalRef.current = null;
    }
    setIsRecording(false);
    setRecDuration(0);

    const session = recorder.stop();
    if (session) {
      session.files = filesAtRecordStartRef.current;
      try {
        await storage.save(session);
        window.dispatchEvent(new CustomEvent('recording_saved'));
        showSuccess(
          `Recording saved! Duration: ${formatDuration(session.duration, 'timer')}, Events: ${session.events.length}`
        );
      } catch (err) {
        console.error('Failed to save recording:', err);
        showError('Failed to save recording');
      }
    }
  };

  const tree = buildTree(store);

  const handleToggleDir = (path: string) => {
    setOpenDirs((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const handleOpenFile = (path: string) => {
    if (!openFiles.includes(path)) setPreviewFile(path);
    setActiveFile(path);
  };

  const handlePinFile = (path: string) => {
    setOpenFiles((prev) => (prev.includes(path) ? prev : [...prev, path]));
    setPreviewFile((prev) => (prev === path ? null : prev));
    setActiveFile(path);
  };

  const handleCloseFile = (path: string) => {
    const index = openTabs.indexOf(path);
    const next = openTabs.filter((p) => p !== path);
    setOpenFiles((prev) => prev.filter((p) => p !== path));
    setPreviewFile((prev) => (prev === path ? null : prev));
    if (activeFile === path) {
      setActiveFile(next[Math.min(index, next.length - 1)] ?? null);
    }
  };

  const handleCreate = (
    dirPath: string,
    name: string,
    type: 'file' | 'directory'
  ) => {
    const path = `${dirPath}/${name}`;
    if (type === 'file') {
      setStore((prev) => createFile(prev, path));
      handlePinFile(path);
    } else {
      setStore((prev) => createDir(prev, path));
      setOpenDirs((prev) => new Set(prev).add(path));
    }
  };

  const handleRename = (path: string, newName: string) => {
    const { store: nextStore, moved } = renamePath(store, path, newName);
    setStore(nextStore);
    const remap = (p: string) => moved.find(([from]) => from === p)?.[1] ?? p;
    setOpenFiles((prev) => prev.map(remap));
    setPreviewFile((prev) => (prev ? remap(prev) : prev));
    setActiveFile((prev) => (prev ? remap(prev) : prev));
    setOpenDirs((prev) => new Set([...prev].map(remap)));
  };

  const handleDelete = (path: string) => {
    setStore((prev) => deletePath(prev, path));
    const isGone = (p: string) => p === path || p.startsWith(path + '/');
    const nextTabs = openTabs.filter((p) => !isGone(p));
    setOpenFiles((prev) => prev.filter((p) => !isGone(p)));
    setPreviewFile((prev) => (prev && isGone(prev) ? null : prev));
    if (activeFile && isGone(activeFile)) {
      setActiveFile(nextTabs[nextTabs.length - 1] ?? null);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-background text-foreground font-sans">
      {/* Topbar */}
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
          <span className="text-muted-foreground hover:text-foreground cursor-pointer transition-colors font-medium">
            Playground
          </span>
          {activeFile && (
            <>
              <span className="text-muted-foreground font-light">/</span>
              <span className="font-semibold text-foreground tracking-wide">
                {activeFile.split('/').pop()}
              </span>
            </>
          )}
        </div>

        <div className="flex items-center gap-3">
          {isRecording && (
            <span className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
              <FaCircle className="text-destructive text-[8px] animate-pulse" />
              {formatDuration(recDuration, 'timer')}
            </span>
          )}
          <div className="relative" ref={playsRef}>
            <button
              onClick={() => setShowPlays((v) => !v)}
              className={`flex items-center gap-1.5 px-3 py-1 rounded text-[11px] font-bold tracking-wider transition-colors cursor-pointer ${
                showPlays
                  ? 'bg-accent text-accent-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent'
              }`}
              title="Play a saved recording"
            >
              <FaPlay className="text-[9px]" />
              PLAYS
              <svg
                width="10"
                height="10"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>

            {showPlays && (
              <div className="absolute top-full mt-2 right-0 w-80 bg-popover text-popover-foreground border border-border rounded-lg shadow-xl z-50 max-h-80 overflow-y-auto">
                {playsLoading ? (
                  <div className="p-4 text-sm text-muted-foreground text-center">
                    Loading recordings…
                  </div>
                ) : plays.length === 0 ? (
                  <div className="p-4 text-sm text-muted-foreground text-center">
                    No recordings yet — hit RECORD to make one
                  </div>
                ) : (
                  plays.map((play) => (
                    <Link
                      key={play.id}
                      href={`/editor?play=${play.id}`}
                      onClick={() => setShowPlays(false)}
                      className="flex items-center justify-between gap-3 px-3 py-2 hover:bg-accent/50 border-b border-border last:border-b-0 transition-colors"
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">
                          {play.title}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {formatDuration(play.duration, 'timer')} •{' '}
                          {new Date(play.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                      <FaPlay className="text-[10px] text-primary flex-shrink-0" />
                    </Link>
                  ))
                )}
              </div>
            )}
          </div>
          <button
            onClick={handleToggleRecording}
            title={isRecording ? 'Stop recording' : 'Start recording'}
            className={`flex items-center gap-1.5 px-4 py-1 rounded text-[11px] font-bold tracking-wider transition-colors cursor-pointer shadow-sm ${
              isRecording
                ? 'bg-destructive hover:bg-destructive/90 text-destructive-foreground'
                : 'bg-primary hover:bg-primary/90 text-primary-foreground'
            }`}
          >
            {isRecording ? (
              <>
                <FaStop className="text-[9px]" />
                STOP
              </>
            ) : (
              <>
                <FaCircle className="text-[9px]" />
                RECORD
              </>
            )}
          </button>
          <div className="w-px h-4 bg-border mx-1"></div>
          <button
            onClick={toggleSidebar}
            className="flex items-center justify-center w-7 h-7 rounded hover:bg-accent text-muted-foreground hover:text-accent-foreground transition-colors cursor-pointer"
            title="Toggle Explorer"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <line x1="9" y1="3" x2="9" y2="21" />
            </svg>
          </button>
          <button
            onClick={toggleTerminal}
            className={`flex items-center justify-center w-7 h-7 rounded hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer ${
              isTerminalOpen
                ? 'bg-accent text-accent-foreground'
                : 'text-muted-foreground'
            }`}
            title="Toggle Terminal"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="4 17 10 11 4 5" />
              <line x1="12" y1="19" x2="20" y2="19" />
            </svg>
          </button>
          <button
            onClick={togglePreview}
            className={`flex items-center justify-center w-7 h-7 rounded hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer ${
              isPreviewOpen
                ? 'bg-accent text-accent-foreground'
                : 'text-muted-foreground'
            }`}
            title="Toggle Browser Preview"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="2" y1="12" x2="22" y2="12" />
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
            </svg>
          </button>
        </div>
      </div>

      <div
        ref={ideAreaRef}
        className="relative flex flex-row flex-grow min-h-0 overflow-hidden bg-background"
      >
        {/* Side menu — plain CSS width animation for a smooth toggle */}
        <div
          className={`flex-shrink-0 overflow-hidden bg-sidebar transition-[width] duration-300 ease-in-out ${
            isSidebarOpen ? 'w-64 border-r border-border' : 'w-0'
          }`}
        >
          <div className="w-64 text-sidebar-foreground h-full overflow-y-auto overflow-x-clip bg-sidebar">
            {sideMenuSelectedTab === 'explorer' && (
              <FileExplorer
                tree={tree}
                openDirs={openDirs}
                activeFile={activeFile}
                onToggleDir={handleToggleDir}
                onOpenFile={handleOpenFile}
                onPinFile={handlePinFile}
                onCreate={handleCreate}
                onRename={handleRename}
                onDelete={handleDelete}
              />
            )}

            {sideMenuSelectedTab === 'about' && (
              <div className="flex flex-col overflow-x-clip">
                <div className="bg-[#252525] text-xs px-2 pb-2 pt-3 shadow z-40 sticky flex flex-col top-0 left-0">
                  <div className="flex-grow font-bold uppercase">
                    OpenScrim Playground
                  </div>
                </div>
                <div className="p-4 text-sm text-white/80">
                  <p>
                    A multi-file coding playground. Files live in memory —
                    recording and playback integration lands here next.
                  </p>
                  <p className="mt-3 text-xs text-white/50">
                    UI ported from rdamn (codedamn clone).
                  </p>
                </div>
              </div>
            )}

            {sideMenuSelectedTab === 'settings' && (
              <div className="flex flex-col overflow-x-clip">
                <div className="bg-[#252525] text-xs px-2 pb-2 pt-3 shadow z-40 sticky flex flex-col top-0 left-0">
                  <div className="flex-grow font-bold uppercase">Settings</div>
                </div>

                <label className="px-4 pt-3 flex items-center cursor-pointer text-sm">
                  <input
                    type="checkbox"
                    checked={editorOptions.wordWrap === 'on'}
                    onChange={() =>
                      setEditorOptions({
                        ...editorOptions,
                        wordWrap:
                          editorOptions.wordWrap === 'on' ? 'off' : 'on',
                      })
                    }
                    className="mr-3 accent-[#ff0000]"
                  />
                  Word Wrap
                </label>

                <label className="px-4 pt-3 flex items-center cursor-pointer text-sm">
                  <input
                    type="checkbox"
                    checked={editorOptions.lineNumbers === 'on'}
                    onChange={() =>
                      setEditorOptions({
                        ...editorOptions,
                        lineNumbers:
                          editorOptions.lineNumbers === 'on' ? 'off' : 'on',
                      })
                    }
                    className="mr-3 accent-[#ff0000]"
                  />
                  Line Numbers
                </label>

                <div className="px-4 pt-3 flex flex-col text-sm">
                  <span className="mb-1">
                    Font Size ({editorOptions.fontSize})
                  </span>
                  <input
                    type="range"
                    min="10"
                    max="25"
                    step="1"
                    className="accent-[#ff0000]"
                    value={editorOptions.fontSize}
                    onChange={(e) =>
                      setEditorOptions({
                        ...editorOptions,
                        fontSize: parseInt(e.target.value),
                      })
                    }
                  />
                </div>

                <div className="px-4 pt-3 flex flex-col text-sm">
                  <span className="mb-1">
                    Tab Size ({editorOptions.tabSize})
                  </span>
                  <input
                    type="range"
                    min="2"
                    max="6"
                    step="2"
                    className="accent-[#ff0000]"
                    value={editorOptions.tabSize}
                    onChange={(e) =>
                      setEditorOptions({
                        ...editorOptions,
                        tabSize: parseInt(e.target.value),
                      })
                    }
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Editor */}
        <div className="flex-grow min-w-0">
          <div className="h-full flex flex-col bg-background">
            {/* Tabs */}
            <div className="flex items-center justify-between bg-background border-b border-border flex-shrink-0">
              <div className="flex items-center overflow-x-auto min-w-0">
                {openTabs.map((path) => {
                  const name = path.split('/').pop() ?? path;
                  const isActive = path === activeFile;
                  const isPreview = path === previewFile;
                  return (
                    <div
                      key={path}
                      onClick={() => setActiveFile(path)}
                      onDoubleClick={() => handlePinFile(path)}
                      title={path}
                      className={`group flex items-center gap-2 px-3 py-2 text-sm border-r border-border cursor-pointer select-none whitespace-nowrap transition-colors ${
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
                      <span
                        className={`font-semibold tracking-wide text-[13px] ${
                          isPreview ? 'italic' : ''
                        }`}
                      >
                        {name}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCloseFile(path);
                        }}
                        className={`rounded p-0.5 hover:bg-accent hover:text-accent-foreground transition-opacity ${
                          isActive
                            ? 'opacity-60 hover:opacity-100'
                            : 'opacity-0 group-hover:opacity-60 hover:!opacity-100'
                        }`}
                        title={`Close ${name}`}
                      >
                        <svg
                          width="12"
                          height="12"
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
                  );
                })}
              </div>
              {activeFile && (
                <div className="px-4 text-[10px] uppercase font-bold text-muted-foreground tracking-widest opacity-60 whitespace-nowrap">
                  CTRL+S TO SAVE
                </div>
              )}
            </div>

            {/* Monaco */}
            <div className="flex-grow min-h-0 bg-background">
              {activeFile !== null ? (
                <Editor
                  height="100%"
                  path={activeFile}
                  value={store.files[activeFile] ?? ''}
                  onChange={(newValue) => {
                    setStore((prev) =>
                      updateFile(prev, activeFile, newValue ?? '')
                    );
                    // Editing a preview tab pins it, like VS Code
                    if (activeFile === previewFile) handlePinFile(activeFile);
                  }}
                  onMount={handleEditorMount}
                  theme="vs-dark"
                  options={editorOptions}
                  className="pt-2"
                />
              ) : (
                <div className="w-full h-full flex flex-col justify-center items-center bg-background text-muted-foreground">
                  <svg
                    width="48"
                    height="48"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="mb-4 opacity-50"
                  >
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                    <line x1="16" y1="13" x2="8" y2="13"></line>
                    <line x1="16" y1="17" x2="8" y2="17"></line>
                    <polyline points="10 9 9 9 8 9"></polyline>
                  </svg>
                  <p className="text-sm font-medium tracking-wide">
                    Select a file to start coding
                  </p>
                </div>
              )}
            </div>

            {/* Terminal — CSS height animation for a smooth toggle */}
            <div
              className={`flex-shrink-0 overflow-hidden transition-[height] duration-300 ease-in-out ${
                isTerminalOpen ? 'h-48 border-t border-border' : 'h-0'
              }`}
            >
              <div className="h-48">
                <TerminalPane />
              </div>
            </div>
          </div>
        </div>

        <FloatingPreviewWindow
          store={store}
          open={isPreviewOpen}
          onClose={togglePreview}
          containerRef={ideAreaRef}
        />
      </div>

      <PlaygroundModal
        open={showTitleModal}
        onOpenChange={setShowTitleModal}
        onStartRecording={startRecording}
      />
    </div>
  );
}
