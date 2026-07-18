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
        className="w-full bg-[#3c3c3c] border border-[#007fd4] text-white text-sm px-1 py-0.5 outline-none"
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
            className="py-1 flex flex-row items-center cursor-pointer hover:bg-[#2a2d2e]"
            style={{ paddingLeft: `${depth * 12}px` }}
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
        className={`py-1 flex flex-row items-center cursor-pointer ${
          activeFile === node.path ? 'bg-[#37373d]' : 'hover:bg-[#2a2d2e]'
        }`}
        style={{ paddingLeft: `${depth * 12 + 4}px` }}
        onClick={() => onOpenFile(node.path)}
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
    <div className="flex flex-col h-full select-none overflow-x-clip text-white">
      <div className="bg-[#252525] text-xs px-2 pb-2 pt-3 shadow z-40 sticky flex items-center top-0 left-0">
        <div className="flex-grow font-bold uppercase">Explorer</div>
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
            defaultValue={pendingInput.type === 'file' ? 'newfile.js' : 'folder'}
            onSubmit={submitInput}
            depth={1}
          />
        )}
        {tree.children.map((child) => renderNode(child, 1))}
      </div>

      {contextMenu && (
        <div
          className="fixed z-50 bg-[#252526] border border-[#454545] rounded shadow-xl py-1 text-sm min-w-[160px]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          {contextMenu.node.type === 'directory' && (
            <>
              <button
                className="w-full text-left px-4 py-1.5 hover:bg-[#094771] cursor-pointer"
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
                className="w-full text-left px-4 py-1.5 hover:bg-[#094771] cursor-pointer"
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
              <div className="border-t border-[#454545] my-1" />
            </>
          )}
          <button
            className="w-full text-left px-4 py-1.5 hover:bg-[#094771] cursor-pointer"
            onClick={() => {
              setRenaming(contextMenu.node.path);
              setContextMenu(null);
            }}
          >
            Rename
          </button>
          <button
            className="w-full text-left px-4 py-1.5 hover:bg-[#094771] cursor-pointer text-red-400"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-[#252526] border border-[#454545] rounded-lg p-4 w-80">
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
