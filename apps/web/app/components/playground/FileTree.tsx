'use client';

import { useState } from 'react';
import { getMaterialFileIcon } from 'file-extension-icon-js';
import type { TreeNode } from './fileStore';

interface FileTreeProps {
  tree: TreeNode;
  activeFile: string | null;
  onSelectFile: (path: string) => void;
  /** Optional tooltip per file */
  fileTitle?: (path: string) => string;
}

/**
 * Read-only directory tree, styled like FileExplorer but without the
 * create/rename/delete affordances. Directories start expanded.
 */
export default function FileTree({
  tree,
  activeFile,
  onSelectFile,
  fileTitle,
}: FileTreeProps) {
  const [closedDirs, setClosedDirs] = useState<Set<string>>(new Set());

  const toggleDir = (path: string) => {
    setClosedDirs((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const renderNode = (node: TreeNode, depth: number) => {
    if (node.type === 'directory') {
      const isOpen = !closedDirs.has(node.path);
      return (
        <div key={node.path}>
          <div
            className="py-1 mx-2 mb-0.5 rounded-md flex flex-row items-center cursor-pointer hover:bg-sidebar-accent hover:text-sidebar-accent-foreground text-sidebar-foreground transition-colors"
            style={{ paddingLeft: `${depth * 12 - 8}px` }}
            onClick={() => toggleDir(node.path)}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4 mr-1.5 min-w-fit"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d={isOpen ? 'M19 9l-7 7-7-7' : 'M9 5l7 7-7 7'}
              />
            </svg>
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
        onClick={() => onSelectFile(node.path)}
        title={fileTitle?.(node.path)}
        className={`py-1 mx-2 mb-0.5 rounded-md flex flex-row items-center cursor-pointer transition-colors ${
          activeFile === node.path
            ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium shadow-sm'
            : 'hover:bg-sidebar-accent/50 text-sidebar-foreground/80 hover:text-sidebar-foreground'
        }`}
        style={{ paddingLeft: `${depth * 12 - 4}px` }}
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
    <div className="text-sm">
      {tree.children.map((child) => renderNode(child, 1))}
    </div>
  );
}
