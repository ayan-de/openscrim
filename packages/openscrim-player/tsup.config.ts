import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: { index: 'src/index.ts' },
    format: ['esm', 'cjs'],
    dts: true,
    clean: true,
  },
  {
    // Self-contained script-tag bundle: window.OpenScrim + auto-init of
    // [data-openscrim-src] elements. Monaco itself is still lazy-loaded
    // from a CDN at runtime, so this stays small.
    entry: { embed: 'src/embed.ts' },
    format: ['iife'],
    globalName: 'OpenScrim',
    platform: 'browser',
    noExternal: [/.*/],
    minify: true,
  },
]);
