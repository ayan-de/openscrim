'use client';

import { useState } from 'react';
import { Editor } from '@monaco-editor/react';
import type * as monacoType from 'monaco-editor';
import { Group, Panel, Separator } from 'react-resizable-panels';

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

  const railTabs: Array<{ tab: SideMenuTab; title: string; icon: React.ReactNode }> = [
    {
      tab: 'explorer',
      title: 'Explorer',
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="w-6 h-12"
          viewBox="0 0 24 24"
        >
          <g fill="currentColor">
            <path d="M17.5 0h-9L7 1.5V6H2.5L1 7.5v15.07L2.5 24h12.07L16 22.57V18h4.7l1.3-1.43V4.5L17.5 0zm0 2.12l2.38 2.38H17.5V2.12zm-3 20.38h-12v-15H7v9.07L8.5 18h6v4.5zm6-6h-12v-15H16V6h4.5v10.5z" />
          </g>
        </svg>
      ),
    },
    {
      tab: 'about',
      title: 'About',
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="w-6 h-12"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      ),
    },
    {
      tab: 'settings',
      title: 'Settings',
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="w-6 h-12"
          viewBox="0 0 16 16"
        >
          <g fill="currentColor">
            <path d="M9.1 4.4L8.6 2H7.4l-.5 2.4l-.7.3l-2-1.3l-.9.8l1.3 2l-.2.7l-2.4.5v1.2l2.4.5l.3.8l-1.3 2l.8.8l2-1.3l.8.3l.4 2.3h1.2l.5-2.4l.8-.3l2 1.3l.8-.8l-1.3-2l.3-.8l2.3-.4V7.4l-2.4-.5l-.3-.8l1.3-2l-.8-.8l-2 1.3l-.7-.2zM9.4 1l.5 2.4L12 2.1l2 2l-1.4 2.1l2.4.4v2.8l-2.4.5L14 12l-2 2l-2.1-1.4l-.5 2.4H6.6l-.5-2.4L4 13.9l-2-2l1.4-2.1L1 9.4V6.6l2.4-.5L2.1 4l2-2l2.1 1.4l.4-2.4h2.8zm.6 7c0 1.1-.9 2-2 2s-2-.9-2-2s.9-2 2-2s2 .9 2 2zM8 9c.6 0 1-.4 1-1s-.4-1-1-1s-1 .4-1 1s.4 1 1 1z" />
          </g>
        </svg>
      ),
    },
  ];

  return (
    <div className="h-screen flex flex-row bg-[#131313] text-white">
      {/* Icon rail */}
      <div className="bg-[#252525] flex flex-col pr-0.5 flex-grow-0 flex-shrink-0 basis-[50px]">
        {railTabs.map(({ tab, title, icon }) => (
          <div
            key={tab}
            title={title}
            className={`mb-1 flex justify-center items-center border-l-[3px] border-solid cursor-pointer ${
              sideMenuSelectedTab === tab && !isSideMenuCollapsed
                ? 'border-white'
                : 'border-[#252525] text-[#979797]'
            }`}
            onClick={() => handleSideMenuTab(tab)}
          >
            {icon}
          </div>
        ))}
      </div>

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
  );
}
