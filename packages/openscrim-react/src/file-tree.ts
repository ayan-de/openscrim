export interface TreeNode {
  type: 'file' | 'directory';
  /** For files: the full path (used for selection). For dirs: a stable id. */
  path: string;
  name: string;
  children: TreeNode[];
}

const LANGUAGE_BY_EXT: Record<string, string> = {
  js: 'javascript',
  jsx: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  ts: 'typescript',
  tsx: 'typescript',
  css: 'css',
  scss: 'scss',
  html: 'html',
  htm: 'html',
  json: 'json',
  md: 'markdown',
  py: 'python',
  rs: 'rust',
  go: 'go',
  java: 'java',
  c: 'c',
  cpp: 'cpp',
  sh: 'shell',
  yml: 'yaml',
  yaml: 'yaml',
};

export function languageForPath(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() ?? '';
  return LANGUAGE_BY_EXT[ext] ?? 'plaintext';
}

/** Longest shared directory prefix across all paths (so trees show relative names). */
function commonDir(paths: string[]): string {
  if (paths.length === 0) return '';
  const split = paths.map((p) => p.split('/'));
  const first = split[0]!;
  let i = 0;
  for (; i < first.length - 1; i++) {
    const seg = first[i];
    if (!split.every((parts) => parts[i] === seg)) break;
  }
  return first.slice(0, i).join('/');
}

function sortTree(node: TreeNode): void {
  node.children.sort((a, b) =>
    a.type !== b.type
      ? a.type === 'directory'
        ? -1
        : 1
      : a.name.localeCompare(b.name)
  );
  node.children.forEach(sortTree);
}

/**
 * Builds a sorted directory tree (dirs first, then alphabetical) from a flat
 * list of file paths. Framework- and root-agnostic: the longest shared
 * directory prefix is stripped so the tree reads relatively.
 */
export function buildFileTree(paths: string[]): TreeNode[] {
  const root: TreeNode = { type: 'directory', path: '', name: '', children: [] };
  const dirNodes = new Map<string, TreeNode>([['', root]]);

  const prefix = commonDir(paths);
  const prefixLen = prefix ? prefix.length + 1 : 0;

  for (const full of paths) {
    const parts = full.slice(prefixLen).split('/').filter(Boolean);
    let parent = root;
    let key = '';
    for (let i = 0; i < parts.length; i++) {
      const seg = parts[i]!;
      const isFile = i === parts.length - 1;
      if (isFile) {
        parent.children.push({ type: 'file', path: full, name: seg, children: [] });
        break;
      }
      key = key ? `${key}/${seg}` : seg;
      let dir = dirNodes.get(key);
      if (!dir) {
        dir = { type: 'directory', path: key, name: seg, children: [] };
        dirNodes.set(key, dir);
        parent.children.push(dir);
      }
      parent = dir;
    }
  }

  sortTree(root);
  return root.children;
}
