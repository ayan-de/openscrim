'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Editor } from '@monaco-editor/react';
import type * as monacoType from 'monaco-editor';
import { FaCircle, FaPlay, FaStop } from 'react-icons/fa';
import { MonacoRecorder } from '@repo/openscrim-monaco';
import { useAuth } from '@/hooks/useAuth';
import { useLoading } from '@/context/LoadingContext';
import { getRecordingStorage } from '@/lib/storage';
import { formatDuration } from '@/lib/formatDuration';

import { getMaterialFileIcon } from 'file-extension-icon-js';
import FileExplorer from '@/components/playground/FileExplorer';
import PreviewBrowser from '@/components/playground/PreviewBrowser';
import TerminalPane from '@/components/playground/TerminalPane';

import {
  STARTER_FILES,
  CODE_ROOT,
  buildTree,
  createDir,
  createFile,
  deletePath,
  renamePath,
  updateFile,
} from '@/components/playground/fileStore';
import type { PlaygroundFiles } from '@/components/playground/fileStore';

type SideMenuTab = 'about' | 'explorer' | 'settings';

export default function EditorPage() {
  const [store, setStore] = useState<PlaygroundFiles>(STARTER_FILES);
  const [openDirs, setOpenDirs] = useState<Set<string>>(new Set([CODE_ROOT]));
  const [, setOpenFiles] = useState<string[]>([`${CODE_ROOT}/index.html`]);
  const [activeFile, setActiveFile] = useState<string | null>(
    `${CODE_ROOT}/index.html`
  );
  const [sideMenuSelectedTab] = useState<SideMenuTab>('explorer');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isTerminalOpen, setIsTerminalOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(true);

  const toggleSidebar = () => setIsSidebarOpen((open) => !open);
  const toggleTerminal = () => setIsTerminalOpen((open) => !open);
  const togglePreview = () => setIsPreviewOpen((open) => !open);

  type PreviewInteraction =
    | 'move'
    | 'n'
    | 's'
    | 'e'
    | 'w'
    | 'ne'
    | 'nw'
    | 'se'
    | 'sw';

  const PREVIEW_MIN_W = 256;
  const PREVIEW_MIN_H = 192;

  const ideAreaRef = useRef<HTMLDivElement>(null);
  const [previewRect, setPreviewRect] = useState<{
    x: number;
    y: number;
    w: number;
    h: number;
  } | null>(null);
  const [isPreviewInteracting, setIsPreviewInteracting] = useState(false);
  const previewInteractionRef = useRef<{
    mode: PreviewInteraction;
    startX: number;
    startY: number;
    base: { x: number; y: number; w: number; h: number };
  } | null>(null);

  // Place the window bottom-right once the IDE area has a measurable size
  useEffect(() => {
    const el = ideAreaRef.current;
    if (!el) return;
    setPreviewRect(
      (prev) =>
        prev ?? {
          x: Math.max(el.clientWidth - 416 - 24, 16),
          y: Math.max(el.clientHeight - 384 - 24, 16),
          w: 416,
          h: 384,
        }
    );
  }, []);

  const startPreviewInteraction =
    (mode: PreviewInteraction) => (e: React.PointerEvent) => {
      if (!previewRect) return;
      e.preventDefault();
      e.stopPropagation();
      previewInteractionRef.current = {
        mode,
        startX: e.clientX,
        startY: e.clientY,
        base: previewRect,
      };
      setIsPreviewInteracting(true);

      const onMove = (ev: PointerEvent) => {
        const s = previewInteractionRef.current;
        if (!s) return;
        const dx = ev.clientX - s.startX;
        const dy = ev.clientY - s.startY;
        let { x, y, w, h } = s.base;

        if (s.mode === 'move') {
          x += dx;
          y += dy;
        } else {
          if (s.mode.includes('e')) w = Math.max(PREVIEW_MIN_W, s.base.w + dx);
          if (s.mode.includes('s')) h = Math.max(PREVIEW_MIN_H, s.base.h + dy);
          if (s.mode.includes('w')) {
            w = Math.max(PREVIEW_MIN_W, s.base.w - dx);
            x = s.base.x + (s.base.w - w);
          }
          if (s.mode.includes('n')) {
            h = Math.max(PREVIEW_MIN_H, s.base.h - dy);
            y = s.base.y + (s.base.h - h);
          }
        }

        setPreviewRect({ x, y, w, h });
      };
      const onUp = () => {
        previewInteractionRef.current = null;
        setIsPreviewInteracting(false);
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
      };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    };

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
  const [isRecording, setIsRecording] = useState(false);
  const [recDuration, setRecDuration] = useState(0);

  const { isAuthenticated } = useAuth();
  const { showSuccess, showError } = useLoading();
  const storage = getRecordingStorage(() => isAuthenticated);

  useEffect(() => {
    return () => {
      if (recIntervalRef.current) clearInterval(recIntervalRef.current);
      recorderRef.current?.dispose();
    };
  }, []);

  const handleEditorMount = (
    editor: monacoType.editor.IStandaloneCodeEditor,
    monaco: typeof monacoType
  ) => {
    recorderRef.current?.dispose();
    recorderRef.current = new MonacoRecorder(editor, monaco);
  };

  const handleToggleRecording = async () => {
    const recorder = recorderRef.current;
    if (!recorder) {
      showError('Open a file first — the editor is not ready yet');
      return;
    }

    if (!isRecording) {
      const fileName = activeFile?.split('/').pop() ?? 'untitled';
      recorder.start(`Editor session — ${fileName}`);
      setIsRecording(true);
      recIntervalRef.current = setInterval(() => {
        setRecDuration(recorder.getCurrentDuration());
      }, 100);
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
    setOpenFiles((prev) => (prev.includes(path) ? prev : [...prev, path]));
    setActiveFile(path);
  };

  const handleCreate = (
    dirPath: string,
    name: string,
    type: 'file' | 'directory'
  ) => {
    const path = `${dirPath}/${name}`;
    if (type === 'file') {
      setStore((prev) => createFile(prev, path));
      handleOpenFile(path);
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
    setActiveFile((prev) => (prev ? remap(prev) : prev));
    setOpenDirs((prev) => new Set([...prev].map(remap)));
  };

  const handleDelete = (path: string) => {
    setStore((prev) => deletePath(prev, path));
    setOpenFiles((prev) => {
      const next = prev.filter((p) => p !== path && !p.startsWith(path + '/'));
      if (
        activeFile &&
        (activeFile === path || activeFile.startsWith(path + '/'))
      ) {
        setActiveFile(next.length > 0 ? (next[next.length - 1] ?? null) : null);
      }
      return next;
    });
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
          <button
            onClick={handleToggleRecording}
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
                <FaPlay className="text-[9px]" />
                RUN
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
        className="relative flex flex-row flex-grow min-h-0 bg-background"
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
            {/* Minimal Tab */}
            <div className="flex items-center justify-between px-4 py-2 bg-background border-b border-border flex-shrink-0">
              <div className="flex items-center gap-2 text-sm text-foreground">
                {activeFile && (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={getMaterialFileIcon(
                        activeFile.split('/').pop() ?? ''
                      )}
                      alt={activeFile}
                      width={16}
                      height={16}
                      className="opacity-90"
                    />
                    <span className="font-semibold tracking-wide text-[13px]">
                      {activeFile.split('/').pop()}
                    </span>
                    <button
                      className="ml-2 text-muted-foreground hover:text-foreground opacity-60 hover:opacity-100 transition-opacity"
                      title="Copy file path"
                    >
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <rect
                          x="9"
                          y="9"
                          width="13"
                          height="13"
                          rx="2"
                          ry="2"
                        ></rect>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                      </svg>
                    </button>
                  </>
                )}
              </div>
              {activeFile && (
                <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest opacity-60">
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

        {/* Preview — floating window, draggable + resizable from all edges/corners */}
        <div
          className={`absolute z-30 flex flex-col rounded-lg border border-border bg-background shadow-2xl transition-opacity duration-200 ${
            isPreviewOpen && previewRect
              ? 'opacity-100'
              : 'opacity-0 pointer-events-none'
          }`}
          style={
            previewRect
              ? {
                  left: previewRect.x,
                  top: previewRect.y,
                  width: previewRect.w,
                  height: previewRect.h,
                }
              : undefined
          }
        >
          {/* Edge handles */}
          <div
            onPointerDown={startPreviewInteraction('n')}
            className="absolute -top-1 left-2 right-2 h-2 cursor-ns-resize z-10"
          />
          <div
            onPointerDown={startPreviewInteraction('s')}
            className="absolute -bottom-1 left-2 right-2 h-2 cursor-ns-resize z-10"
          />
          <div
            onPointerDown={startPreviewInteraction('w')}
            className="absolute -left-1 top-2 bottom-2 w-2 cursor-ew-resize z-10"
          />
          <div
            onPointerDown={startPreviewInteraction('e')}
            className="absolute -right-1 top-2 bottom-2 w-2 cursor-ew-resize z-10"
          />
          {/* Corner handles */}
          <div
            onPointerDown={startPreviewInteraction('nw')}
            className="absolute -top-1 -left-1 w-3.5 h-3.5 cursor-nwse-resize z-20"
          />
          <div
            onPointerDown={startPreviewInteraction('ne')}
            className="absolute -top-1 -right-1 w-3.5 h-3.5 cursor-nesw-resize z-20"
          />
          <div
            onPointerDown={startPreviewInteraction('sw')}
            className="absolute -bottom-1 -left-1 w-3.5 h-3.5 cursor-nesw-resize z-20"
          />
          <div
            onPointerDown={startPreviewInteraction('se')}
            className="absolute -bottom-1 -right-1 w-3.5 h-3.5 cursor-nwse-resize z-20"
          />

          <div
            onPointerDown={startPreviewInteraction('move')}
            className="flex items-center justify-between px-3 py-1.5 bg-sidebar border-b border-border cursor-move select-none flex-shrink-0 rounded-t-lg"
          >
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Preview
            </span>
            <button
              onClick={togglePreview}
              onPointerDown={(e) => e.stopPropagation()}
              className="text-muted-foreground hover:text-foreground p-0.5 rounded hover:bg-accent cursor-pointer"
              title="Close Preview"
            >
              <svg
                width="14"
                height="14"
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
          <div
            className={`flex-grow min-h-0 overflow-hidden rounded-b-lg ${
              isPreviewInteracting ? 'pointer-events-none' : ''
            }`}
          >
            <PreviewBrowser store={store} />
          </div>
        </div>
      </div>
    </div>
  );
}
