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
import TerminalPane from '@/components/playground/TerminalPane';
import {
  STARTER_FILES,
  CODE_ROOT,
  buildTree,
  createDir,
  createFile,
  deletePath,
  displayPath,
  renamePath,
  updateFile,
} from '@/components/playground/fileStore';
import type { PlaygroundFiles } from '@/components/playground/fileStore';

type SideMenuTab = 'about' | 'explorer' | 'settings';

export default function EditorPage() {
  const [store, setStore] = useState<PlaygroundFiles>(STARTER_FILES);
  const [openDirs, setOpenDirs] = useState<Set<string>>(new Set([CODE_ROOT]));
  const [openFiles, setOpenFiles] = useState<string[]>([
    `${CODE_ROOT}/index.html`,
  ]);
  const [activeFile, setActiveFile] = useState<string | null>(
    `${CODE_ROOT}/index.html`
  );
  const [sideMenuSelectedTab, setSideMenuSelectedTab] =
    useState<SideMenuTab>('explorer');
  const [isSideMenuCollapsed, setIsSideMenuCollapsed] = useState(false);

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

  const handleSideMenuTab = (tab: SideMenuTab) => {
    if (sideMenuSelectedTab === tab || isSideMenuCollapsed) {
      setIsSideMenuCollapsed(sideMenuSelectedTab === tab && !isSideMenuCollapsed);
    }
    setSideMenuSelectedTab(tab);
  };

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

  const handleCloseFile = (path: string) => {
    setOpenFiles((prev) => {
      const idx = prev.indexOf(path);
      const next = prev.filter((p) => p !== path);
      if (activeFile === path) {
        setActiveFile(
          next.length > 0
            ? (next[Math.max(idx - 1, 0) % next.length] ?? null)
            : null
        );
      }
      return next;
    });
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
      if (activeFile && (activeFile === path || activeFile.startsWith(path + '/'))) {
        setActiveFile(next.length > 0 ? (next[next.length - 1] ?? null) : null);
      }
      return next;
    });
  };



  return (
    <div className="h-screen flex flex-col bg-[#131313] text-white">
      {/* Topbar */}
      <div className="flex items-center justify-between flex-shrink-0 h-[42px] px-3 bg-[#252525] border-b border-[#3b3b3b]">
        <div className="flex items-center gap-3">
          <Link href="/" className="font-bold text-sm select-none">
            Open<span className="text-[#ff0000]">Scrim</span>
          </Link>
          {activeFile && (
            <span className="text-xs text-white/40 hidden sm:inline">
              {displayPath(activeFile)}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {isRecording && (
            <span className="flex items-center gap-2 text-xs font-mono text-white/80 mr-1">
              <FaCircle className="text-[#ff0000] text-[8px] animate-pulse" />
              {formatDuration(recDuration, 'timer')}
            </span>
          )}
          <button
            onClick={handleToggleRecording}
            className={`flex items-center gap-2 px-4 py-1.5 rounded text-sm font-medium transition-colors cursor-pointer ${
              isRecording
                ? 'bg-[#ff0000] hover:bg-[#d90000] text-white'
                : 'bg-[#3b3b3b] hover:bg-[#4a4a4a] text-white'
            }`}
          >
            {isRecording ? (
              <>
                <FaStop className="text-xs" />
                Stop
              </>
            ) : (
              <>
                <FaCircle className="text-xs text-[#ff0000]" />
                Record
              </>
            )}
          </button>
          <Link
            href="/view"
            className="flex items-center gap-2 px-4 py-1.5 rounded text-sm font-medium bg-[#3b3b3b] hover:bg-[#4a4a4a] text-white transition-colors"
          >
            <FaPlay className="text-xs" />
            View
          </Link>
        </div>
      </div>

      <div className="flex flex-row flex-grow min-h-0">


      <Group orientation="horizontal">
        {/* Side menu */}
        {!isSideMenuCollapsed && (
          <>
            <Panel defaultSize="20" minSize="10">
              <div className="bg-[#131313] text-white h-full w-full overflow-y-auto overflow-x-clip">
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
                      <div className="flex-grow font-bold uppercase">
                        Settings
                      </div>
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
            </Panel>
            <Separator className="w-1 bg-[#3b3b3b]" />
          </>
        )}

        {/* Editor + terminal */}
        <Panel defaultSize="45" minSize="20">
          <Group orientation="vertical">
            <Panel defaultSize="55" minSize="20">
              <div className="h-full flex flex-col">
                {/* File tabs */}
                <div
                  onMouseDown={(e) => e.preventDefault()}
                  className="overflow-x-auto overflow-y-hidden flex justify-start flex-shrink-0 basis-[35px] bg-[#161616] text-sm"
                >
                  {openFiles.map((filePath) => (
                    <div
                      key={filePath}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        if (e.button === 1) handleCloseFile(filePath);
                      }}
                      className={`select-none flex justify-center items-center p-2 cursor-pointer h-full border-t-2 border-solid whitespace-nowrap ${
                        activeFile === filePath
                          ? 'bg-[#1e1e1e] text-white border-[#ff0000]'
                          : 'bg-[#2d2d2d] text-[#888] border-transparent hover:bg-[#292929]'
                      }`}
                      title={displayPath(filePath)}
                    >
                      <div
                        className="flex min-w-fit mr-1.5"
                        onClick={() => setActiveFile(filePath)}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={getMaterialFileIcon(
                            filePath.split('/').pop() ?? ''
                          )}
                          alt={filePath}
                          width={18}
                          height={18}
                        />
                      </div>
                      <p onClick={() => setActiveFile(filePath)}>
                        {filePath.split('/').pop()}
                      </p>
                      <div
                        onClick={() => handleCloseFile(filePath)}
                        className="flex min-w-fit rounded hover:opacity-100 text-white hover:bg-gray-600 opacity-50 ml-1.5 p-0.5"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="w-[18px] h-[18px] fill-current"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Monaco */}
                <div className="flex-grow min-h-0">
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
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col justify-center items-center bg-[#131313] text-white">
                      <h1 className="text-3xl font-bold">
                        Open<span className="text-[#ff0000]">Scrim</span>
                      </h1>
                      <p className="mx-5 my-2 text-center text-sm opacity-60">
                        Open a file from the explorer to start coding
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </Panel>

            <Separator className="h-1 bg-[#3b3b3b]" />

            <Panel defaultSize="45" minSize="10">
              <TerminalPane />
            </Panel>
          </Group>
        </Panel>

        <Separator className="w-1 bg-[#3b3b3b]" />

        {/* Preview */}
        <Panel defaultSize="35" minSize="15">
          <PreviewBrowser store={store} />
        </Panel>
      </Group>
      </div>
    </div>
  );
}
