'use client';

import { useMemo, useState } from 'react';
import type { PlaygroundFiles } from './fileStore';
import { CODE_ROOT } from './fileStore';

interface PreviewBrowserProps {
  store: PlaygroundFiles;
}

/**
 * Renders the in-memory playground files in a sandboxed iframe.
 * Inlines styles.css and script.js into index.html so no server is needed.
 */
export default function PreviewBrowser({ store }: PreviewBrowserProps) {
  const [refreshKey, setRefreshKey] = useState(0);

  const srcDoc = useMemo(() => {
    const html = store.files[`${CODE_ROOT}/index.html`];
    if (html === undefined) {
      return '<body style="background:#131313;color:#888;font-family:sans-serif;display:grid;place-items:center;min-height:90vh"><p>Create an index.html to see a preview</p></body>';
    }

    let doc = html;
    for (const [path, content] of Object.entries(store.files)) {
      const name = path.split('/').pop() ?? '';
      if (name.endsWith('.css')) {
        const linkTag = new RegExp(
          `<link[^>]*href=["']${name}["'][^>]*/?>`,
          'g'
        );
        doc = linkTag.test(doc)
          ? doc.replace(linkTag, `<style>${content}</style>`)
          : doc;
      }
      if (name.endsWith('.js')) {
        const scriptTag = new RegExp(
          `<script[^>]*src=["']${name}["'][^>]*>\\s*</script>`,
          'g'
        );
        doc = scriptTag.test(doc)
          ? doc.replace(scriptTag, `<script>${content}</script>`)
          : doc;
      }
    }
    return doc;
  }, [store]);

  return (
    <div className="w-full h-full flex flex-col bg-[#131313]">
      <div className="flex items-center gap-2 px-2 py-1.5 bg-[#252525] border-b border-[#3b3b3b]">
        <button
          title="Refresh Preview"
          onClick={() => setRefreshKey((k) => k + 1)}
          className="text-white/70 hover:text-white p-1 cursor-pointer"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
        </button>
        <div className="flex-grow bg-[#131313] text-white/50 text-xs rounded px-3 py-1 select-none">
          playground://preview/index.html
        </div>
      </div>
      <iframe
        key={refreshKey}
        srcDoc={srcDoc}
        sandbox="allow-scripts"
        title="Preview"
        className="flex-grow w-full bg-white"
      />
    </div>
  );
}
