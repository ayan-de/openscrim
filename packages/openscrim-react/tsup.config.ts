import { defineConfig } from 'tsup';

export default defineConfig({
  entry: { index: 'src/index.ts' },
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  // Components and hooks run in the browser; mark the whole bundle as a
  // client module so it drops straight into a Next.js App Router / RSC tree.
  banner: { js: "'use client';" },
  // react, react-dom, @monaco-editor/react, monaco-editor and the openscrim
  // packages resolve from the consumer's node_modules (deps + peerDeps are
  // externalized by tsup automatically).
});
