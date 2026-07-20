import { useState } from 'react';
import type { TreeNode } from './file-tree.js';

export interface FileTreeProps {
  nodes: TreeNode[];
  activeFile: string | null;
  onSelectFile: (path: string) => void;
  fileTitle?: (path: string) => string;
  /** Custom icon per file (e.g. material file-type icons). Defaults to a glyph. */
  renderIcon?: (name: string, node: TreeNode) => React.ReactNode;
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d={open ? 'M6 9l6 6 6-6' : 'M9 6l6 6-6 6'} />
    </svg>
  );
}

function FileIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  );
}

/**
 * Read-only directory tree over a recording's files. Directories start
 * expanded; clicking a file calls `onSelectFile(path)`. Styling comes from the
 * injected OpenScrim stylesheet (`os-tree*` classes), so it themes with the
 * rest of the player.
 */
export function FileTree({ nodes, activeFile, onSelectFile, fileTitle, renderIcon }: FileTreeProps) {
  const [closed, setClosed] = useState<Set<string>>(new Set());

  const toggle = (path: string) =>
    setClosed((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });

  const render = (node: TreeNode, depth: number): React.ReactNode => {
    const pad = { paddingLeft: `${8 + depth * 12}px` };
    if (node.type === 'directory') {
      const open = !closed.has(node.path);
      return (
        <div key={`d:${node.path}`}>
          <div className="os-tree-row" style={pad} onClick={() => toggle(node.path)}>
            <Chevron open={open} />
            <span className="os-tree-name">{node.name}</span>
          </div>
          {open && node.children.map((child) => render(child, depth + 1))}
        </div>
      );
    }
    return (
      <div
        key={`f:${node.path}`}
        className="os-tree-row"
        data-active={activeFile === node.path}
        style={pad}
        title={fileTitle?.(node.path)}
        onClick={() => onSelectFile(node.path)}
      >
        {renderIcon ? renderIcon(node.name, node) : <FileIcon />}
        <span className="os-tree-name">{node.name}</span>
      </div>
    );
  };

  return <div className="os-tree">{nodes.map((n) => render(n, 0))}</div>;
}
