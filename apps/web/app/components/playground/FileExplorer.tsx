'use client';

import { useEffect, useRef, useState } from 'react';
import { getMaterialFileIcon } from 'file-extension-icon-js';
import type { TreeNode } from './fileStore';
import { CODE_ROOT } from './fileStore';

interface FileExplorerProps {
  tree: TreeNode;
  openDirs: Set<string>;
  activeFile: string | null;
  onToggleDir: (path: string) => void;
  onOpenFile: (path: string) => void;
  /** Double click — open the file as a permanent (non-preview) tab */
  onPinFile: (path: string) => void;
  onCreate: (dirPath: string, name: string, type: 'file' | 'directory') => void;
  onRename: (path: string, newName: string) => void;
  onDelete: (path: string) => void;
}

interface ContextMenuState {
  x: number;
  y: number;
  node: TreeNode;
}

interface PendingInput {
  dirPath: string;
  type: 'file' | 'directory';
}

export default function FileExplorer({
  tree,
  openDirs,
  activeFile,
  onToggleDir,
  onOpenFile,
  onPinFile,
  onCreate,
  onRename,
  onDelete,
}: FileExplorerProps) {
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [pendingInput, setPendingInput] = useState<PendingInput | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    window.addEventListener('click', close);
    window.addEventListener('contextmenu', close);
    return () => {
      window.removeEventListener('click', close);
      window.removeEventListener('contextmenu', close);
    };
  }, [contextMenu]);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [pendingInput, renaming]);

  const submitInput = (value: string) => {
    const name = value.trim();
    if (pendingInput && name) {
      onCreate(pendingInput.dirPath, name, pendingInput.type);
    }
    setPendingInput(null);
  };

  const submitRename = (path: string, value: string) => {
    const name = value.trim();
    if (name && name !== path.split('/').pop()) {
      onRename(path, name);
    }
    setRenaming(null);
  };

  const NameInput = ({
    defaultValue,
    onSubmit,
    depth,
  }: {
    defaultValue: string;
    onSubmit: (value: string) => void;
    depth: number;
  }) => (
    <div
      className="py-0.5 flex items-center"
      style={{ paddingLeft: `${depth * 12 + 8}px` }}
    >
      <input
        ref={inputRef}
        defaultValue={defaultValue}
        onBlur={(e) => onSubmit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onSubmit(e.currentTarget.value);
          if (e.key === 'Escape') {
            setPendingInput(null);
            setRenaming(null);
          }
        }}
        className="w-full bg-input border border-ring text-foreground text-sm px-1 py-0.5 outline-none rounded-sm"
      />
    </div>
  );

  const renderNode = (node: TreeNode, depth: number) => {
    if (renaming === node.path) {
      return (
        <NameInput
          key={node.path}
          defaultValue={node.name}
          onSubmit={(v) => submitRename(node.path, v)}
          depth={depth}
        />
      );
    }

    if (node.type === 'directory') {
      const isOpen = openDirs.has(node.path);
      return (
        <div key={node.path}>
          <div
            className="py-1 mx-2 mb-0.5 rounded-md flex flex-row items-center cursor-pointer hover:bg-sidebar-accent hover:text-sidebar-accent-foreground text-sidebar-foreground transition-colors"
            style={{ paddingLeft: `${depth * 12 - 8}px` }}
            onClick={() => onToggleDir(node.path)}
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setContextMenu({ x: e.clientX, y: e.clientY, node });
            }}
          >
            <div className="flex min-w-fit">
              {isOpen ? (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4 mr-1.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              ) : (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4 mr-1.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              )}
            </div>
            <p className="flex-grow overflow-hidden select-none text-ellipsis opacity-80">
              {node.name}
            </p>
          </div>
          {isOpen && node.children.map((child) => renderNode(child, depth + 1))}
        </div>
      );
    }

    return (
      <div
        key={node.path}
        className={`py-1 mx-2 mb-0.5 rounded-md flex flex-row items-center cursor-pointer transition-colors ${
          activeFile === node.path
            ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium shadow-sm'
            : 'hover:bg-sidebar-accent/50 text-sidebar-foreground/80 hover:text-sidebar-foreground'
        }`}
        style={{ paddingLeft: `${depth * 12 - 4}px` }}
        onClick={() => onOpenFile(node.path)}
        onDoubleClick={() => onPinFile(node.path)}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setContextMenu({ x: e.clientX, y: e.clientY, node });
        }}
      >
        <div className="flex min-w-fit mr-1.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={getMaterialFileIcon(node.name)}
            alt={node.name}
            width={18}
            height={18}
          />
        </div>
        <p className="flex-grow overflow-hidden select-none text-ellipsis opacity-80">
          {node.name}
        </p>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full select-none overflow-x-clip bg-sidebar text-sidebar-foreground">
      <div className="text-xs px-4 pb-2 pt-4 sticky flex items-center top-0 left-0">
        <div className="flex-grow font-semibold uppercase tracking-wider text-[11px] opacity-70">
          Files
        </div>
        <button
          title="New File"
          className="flex items-center justify-center mx-1 cursor-pointer text-base opacity-80 hover:opacity-100"
          onClick={() => setPendingInput({ dirPath: CODE_ROOT, type: 'file' })}
        >
          <svg
            stroke="currentColor"
            fill="currentColor"
            strokeWidth="0"
            viewBox="0 0 16 16"
            height="1em"
            width="1em"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              fillRule="evenodd"
              clipRule="evenodd"
              d="M9.5 1.1l3.4 3.5.1.4v8.4l-.5.5h-10l-.5-.5V1.5l.5-.5h6.7l.3.1zM9 2H3v11h9V5H9.5L9 4.5V2zm1 0v2h2l-2-2zM4 13h1V8h4V7H4v6z"
            />
          </svg>
        </button>
        <button
          title="New Folder"
          className="ml-2 flex items-center justify-center mx-1 cursor-pointer text-base opacity-80 hover:opacity-100"
          onClick={() =>
            setPendingInput({ dirPath: CODE_ROOT, type: 'directory' })
          }
        >
          <svg
            stroke="currentColor"
            fill="currentColor"
            strokeWidth="0"
            viewBox="0 0 16 16"
            height="1em"
            width="1em"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              fillRule="evenodd"
              clipRule="evenodd"
              d="M14.5 2H7.71l-.85-.85L6.51 1h-5l-.5.5v11l.5.5H7v-1H1.99V6h4.49l.35-.15.86-.86H14v1.5l-.001.51h1.011V2.5L14.5 2zm-.51 2h-6.5l-.35.15-.86.86H2v-3h4.29l.85.85.36.15H14l-.01.99zM13 16h-1v-3H9v-1h3V9h1v3h3v1h-3v3z"
            />
          </svg>
        </button>
      </div>

      <div className="text-sm flex-grow overflow-y-auto">
        {pendingInput && pendingInput.dirPath === CODE_ROOT && (
          <NameInput
            defaultValue={
              pendingInput.type === 'file' ? 'newfile.js' : 'folder'
            }
            onSubmit={submitInput}
            depth={1}
          />
        )}
        {tree.children.map((child) => renderNode(child, 1))}
      </div>

      <div className="text-xs px-4 py-3 mt-4 border-t border-sidebar-border sticky flex items-center bottom-0 left-0 bg-sidebar">
        <div className="flex-grow font-semibold uppercase tracking-wider text-[11px] opacity-70">
          Dependencies
        </div>
        <button
          title="Add Dependency"
          className="flex items-center justify-center cursor-pointer text-base opacity-70 hover:opacity-100 transition-opacity"
        >
          <svg
            stroke="currentColor"
            fill="currentColor"
            strokeWidth="0"
            viewBox="0 0 16 16"
            height="1em"
            width="1em"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              fillRule="evenodd"
              clipRule="evenodd"
              d="M8 1.5a.5.5 0 01.5.5v5.5H14a.5.5 0 010 1H8.5V14a.5.5 0 01-1 0V8.5H2a.5.5 0 010-1h5.5V2a.5.5 0 01.5-.5z"
            ></path>
          </svg>
        </button>
      </div>

      {contextMenu && (
        <div
          className="fixed z-50 bg-popover text-popover-foreground border border-border rounded-md shadow-md py-1 text-sm min-w-[160px]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          {contextMenu.node.type === 'directory' && (
            <>
              <button
                className="w-full text-left px-4 py-1.5 hover:bg-accent hover:text-accent-foreground cursor-pointer"
                onClick={() => {
                  onToggleDir(contextMenu.node.path);
                  setPendingInput({
                    dirPath: contextMenu.node.path,
                    type: 'file',
                  });
                  setContextMenu(null);
                }}
              >
                New File
              </button>
              <button
                className="w-full text-left px-4 py-1.5 hover:bg-accent hover:text-accent-foreground cursor-pointer"
                onClick={() => {
                  setPendingInput({
                    dirPath: contextMenu.node.path,
                    type: 'directory',
                  });
                  setContextMenu(null);
                }}
              >
                New Folder
              </button>
              <div className="border-t border-border my-1" />
            </>
          )}
          <button
            className="w-full text-left px-4 py-1.5 hover:bg-accent hover:text-accent-foreground cursor-pointer"
            onClick={() => {
              setRenaming(contextMenu.node.path);
              setContextMenu(null);
            }}
          >
            Rename
          </button>
          <button
            className="w-full text-left px-4 py-1.5 hover:bg-destructive hover:text-destructive-foreground cursor-pointer text-destructive"
            onClick={() => {
              onDelete(contextMenu.node.path);
              setContextMenu(null);
            }}
          >
            Delete
          </button>
        </div>
      )}

      {pendingInput && pendingInput.dirPath !== CODE_ROOT && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="bg-card text-card-foreground border border-border rounded-lg p-4 w-80 shadow-lg">
            <p className="text-sm mb-2">
              New {pendingInput.type} in{' '}
              <code className="text-xs opacity-70">
                {pendingInput.dirPath.replace('/home/rdamn/', '~/')}
              </code>
            </p>
            <NameInput
              defaultValue={
                pendingInput.type === 'file' ? 'newfile.js' : 'folder'
              }
              onSubmit={submitInput}
              depth={0}
            />
          </div>
        </div>
      )}
    </div>
  );
}
