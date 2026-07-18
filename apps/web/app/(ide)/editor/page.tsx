'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Editor } from '@monaco-editor/react';
import type * as monacoType from 'monaco-editor';
import { Group, Panel, Separator } from 'react-resizable-panels';
import { FaCircle, FaPlay, FaStop } from 'react-icons/fa';
import { MonacoRecorder } from '@repo/openscrim-monaco';
import { useAuth } from '@/hooks/useAuth';
import { useLoading } from '@/context/LoadingContext';
import { getRecordingStorage } from '@/lib/storage';
import { formatDuration } from '@/lib/formatDuration';

import { getMaterialFileIcon } from 'file-extension-icon-js';
import FileExplorer from '@/components/playground/FileExplorer';
import PreviewBrowser from '@/components/playground/PreviewBrowser';

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

  const toggleSidebar = () => setIsSidebarOpen((open) => !open);

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
        </div>
      </div>

      <div className="flex flex-row flex-grow min-h-0 bg-background">
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

        <Group orientation="horizontal">
          {/* Editor */}
          <Panel defaultSize="50" minSize="20">
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
            </div>
          </Panel>

          <Separator className="w-px bg-border" />

          {/* Preview */}
          <Panel defaultSize="30" minSize="15">
            <PreviewBrowser store={store} />
          </Panel>
        </Group>
      </div>
    </div>
  );
}
