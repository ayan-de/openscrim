export const CODE_ROOT = '/home/rdamn/code';

export interface TreeNode {
  type: 'directory' | 'file';
  path: string;
  name: string;
  children: TreeNode[];
}

export interface PlaygroundFiles {
  /** file path → content */
  files: Record<string, string>;
  /** every directory path, including empty ones */
  dirs: string[];
}

export const STARTER_FILES: PlaygroundFiles = {
  files: {
    [`${CODE_ROOT}/index.html`]: `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>OpenScrim Playground</title>
    <link rel="stylesheet" href="styles.css" />
  </head>
  <body>
    <h1>Hello, OpenScrim!</h1>
    <p>Edit these files and watch the preview update.</p>
    <button id="btn">Click me</button>
    <script src="script.js"></script>
  </body>
</html>
`,
    [`${CODE_ROOT}/styles.css`]: `body {
  font-family: system-ui, sans-serif;
  background: #131313;
  color: #eee;
  display: grid;
  place-items: center;
  min-height: 100vh;
}

button {
  background: #ff0000;
  color: white;
  border: 0;
  padding: 0.5rem 1.5rem;
  border-radius: 6px;
  cursor: pointer;
}
`,
    [`${CODE_ROOT}/script.js`]: `document.getElementById('btn').addEventListener('click', () => {
  document.querySelector('h1').textContent = 'You clicked!';
});
`,
  },
  dirs: [CODE_ROOT],
};

export const REACT_STARTER_FILES: PlaygroundFiles = {
  files: {
    [`${CODE_ROOT}/index.html`]: `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>React Playground</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="./src/main.jsx"></script>
  </body>
</html>
`,
    [`${CODE_ROOT}/src/main.jsx`]: `import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles.css';

createRoot(document.getElementById('root')).render(<App />);
`,
    [`${CODE_ROOT}/src/App.jsx`]: `import { useState } from 'react';

export default function App() {
  const [count, setCount] = useState(0);

  return (
    <main>
      <h1>Hello, React!</h1>
      <p>
        Edit <code>src/App.jsx</code> and watch the preview update.
      </p>
      <button onClick={() => setCount((c) => c + 1)}>count is {count}</button>
    </main>
  );
}
`,
    [`${CODE_ROOT}/src/styles.css`]: `body {
  font-family: system-ui, sans-serif;
  background: #131313;
  color: #eee;
  display: grid;
  place-items: center;
  min-height: 100vh;
  text-align: center;
}

button {
  background: #ff0000;
  color: white;
  border: 0;
  padding: 0.5rem 1.5rem;
  border-radius: 6px;
  cursor: pointer;
  font-size: 1rem;
}
`,
  },
  dirs: [CODE_ROOT, `${CODE_ROOT}/src`],
};

export type PlaygroundTemplate = 'vanilla' | 'react';

export function starterFilesFor(template: PlaygroundTemplate): {
  store: PlaygroundFiles;
  entryFile: string;
} {
  if (template === 'react') {
    return {
      store: REACT_STARTER_FILES,
      entryFile: `${CODE_ROOT}/src/App.jsx`,
    };
  }
  return { store: STARTER_FILES, entryFile: `${CODE_ROOT}/index.html` };
}

function parentDirs(path: string): string[] {
  const parts = path.split('/').filter(Boolean);
  const result: string[] = [];
  for (let i = 1; i < parts.length; i++) {
    result.push('/' + parts.slice(0, i).join('/'));
  }
  return result;
}

/** Builds a sorted tree (directories first, then alphabetical) rooted at CODE_ROOT. */
export function buildTree(store: PlaygroundFiles): TreeNode {
  const nodes = new Map<string, TreeNode>();

  const ensureDir = (path: string): TreeNode => {
    let node = nodes.get(path);
    if (!node) {
      node = {
        type: 'directory',
        path,
        name: path.split('/').pop() ?? path,
        children: [],
      };
      nodes.set(path, node);
    }
    return node;
  };

  ensureDir(CODE_ROOT);
  const allDirs = new Set<string>(store.dirs);
  for (const filePath of Object.keys(store.files)) {
    for (const dir of parentDirs(filePath)) {
      if (dir.startsWith(CODE_ROOT)) allDirs.add(dir);
    }
  }

  for (const dir of allDirs) {
    if (!dir.startsWith(CODE_ROOT)) continue;
    const node = ensureDir(dir);
    if (dir !== CODE_ROOT) {
      const parent = ensureDir(dir.slice(0, dir.lastIndexOf('/')));
      if (!parent.children.includes(node)) parent.children.push(node);
    }
  }

  for (const filePath of Object.keys(store.files)) {
    if (!filePath.startsWith(CODE_ROOT)) continue;
    const parent = ensureDir(filePath.slice(0, filePath.lastIndexOf('/')));
    parent.children.push({
      type: 'file',
      path: filePath,
      name: filePath.split('/').pop() ?? filePath,
      children: [],
    });
  }

  const sortChildren = (node: TreeNode) => {
    node.children.sort((a, b) =>
      a.type !== b.type
        ? a.type === 'directory'
          ? -1
          : 1
        : a.name.localeCompare(b.name)
    );
    node.children.forEach(sortChildren);
  };
  const root = nodes.get(CODE_ROOT)!;
  sortChildren(root);
  return root;
}

export function createFile(
  store: PlaygroundFiles,
  path: string
): PlaygroundFiles {
  if (path in store.files) return store;
  return { ...store, files: { ...store.files, [path]: '' } };
}

export function createDir(
  store: PlaygroundFiles,
  path: string
): PlaygroundFiles {
  if (store.dirs.includes(path)) return store;
  return { ...store, dirs: [...store.dirs, path] };
}

export function updateFile(
  store: PlaygroundFiles,
  path: string,
  content: string
): PlaygroundFiles {
  return { ...store, files: { ...store.files, [path]: content } };
}

/** Deletes a file, or a directory and everything under it. */
export function deletePath(
  store: PlaygroundFiles,
  path: string
): PlaygroundFiles {
  const files = Object.fromEntries(
    Object.entries(store.files).filter(
      ([p]) => p !== path && !p.startsWith(path + '/')
    )
  );
  const dirs = store.dirs.filter(
    (d) => d !== path && !d.startsWith(path + '/')
  );
  return { files, dirs };
}

/** Renames a file or directory (and all its descendants). Returns old→new path pairs. */
export function renamePath(
  store: PlaygroundFiles,
  oldPath: string,
  newName: string
): { store: PlaygroundFiles; moved: Array<[string, string]> } {
  const newPath = oldPath.slice(0, oldPath.lastIndexOf('/') + 1) + newName;
  const moved: Array<[string, string]> = [];
  const remap = (p: string): string => {
    if (p === oldPath || p.startsWith(oldPath + '/')) {
      const next = newPath + p.slice(oldPath.length);
      moved.push([p, next]);
      return next;
    }
    return p;
  };
  const files = Object.fromEntries(
    Object.entries(store.files).map(([p, content]) => [remap(p), content])
  );
  const dirs = store.dirs.map(remap);
  return { store: { files, dirs }, moved };
}

export function displayPath(path: string): string {
  return path.replace('/home/rdamn/', '~/');
}

const LANGUAGE_BY_EXT: Record<string, string> = {
  js: 'javascript',
  jsx: 'javascript',
  ts: 'typescript',
  tsx: 'typescript',
  css: 'css',
  html: 'html',
  htm: 'html',
  json: 'json',
  md: 'markdown',
};

export function languageForPath(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() ?? '';
  return LANGUAGE_BY_EXT[ext] ?? 'plaintext';
}
