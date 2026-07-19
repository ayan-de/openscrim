# OpenScrim

**Open-source interactive code screencasts.** Record a coding session as events — not pixels — and play it back like a video that viewers can **pause, edit, and fork at any moment**.

[![npm — core](https://img.shields.io/npm/v/%40thisisayande%2Fopenscrim-core?label=%40thisisayande%2Fopenscrim-core)](https://www.npmjs.com/package/@thisisayande/openscrim-core)
[![npm — monaco](https://img.shields.io/npm/v/%40thisisayande%2Fopenscrim-monaco?label=%40thisisayande%2Fopenscrim-monaco)](https://www.npmjs.com/package/@thisisayande/openscrim-monaco)
[![license](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

<!-- TODO: demo GIF here — record a scrim being played + forked, ~10s -->

## Why events instead of video?

Platforms like Scrimba proved that the best way to teach code isn't video — it's a recording of the *editor itself*. OpenScrim is an open implementation of that idea:

- 🎬 **Tiny recordings** — a session is a stream of timestamped keystrokes, cursor moves, and edits. Roughly 100× smaller than pixel video.
- ⏯️ **True seek** — jump anywhere instantly; playback is deterministic event replay, not decoded frames.
- 🍴 **Forkable** — pause at any timestamp and the viewer gets the instructor's exact code, editable, in the same editor.
- 📄 **Selectable, real text** — viewers can copy code straight out of the "video".
- 🔓 **Open format** — recordings are portable `.tantrica` files (gzipped JSON with a fast-readable metadata header). No lock-in.

## Embed a player (no build tools)

One div + one script tag — Monaco is lazy-loaded from a CDN, viewers get play/pause/seek/speed and can pause to edit the code:

```html
<div data-openscrim-src="/recordings/intro.tantrica" data-height="420px"></div>
<script src="https://cdn.jsdelivr.net/npm/@thisisayande/openscrim-player/dist/embed.global.js"></script>
```

## Use the SDK

Embed recording and playback in any app that hosts a [Monaco editor](https://microsoft.github.io/monaco-editor/):

```bash
npm install @thisisayande/openscrim-monaco monaco-editor
```

**Record:**

```ts
import { MonacoRecorder } from '@thisisayande/openscrim-monaco';

const recorder = new MonacoRecorder(editor, monaco);
recorder.start();
// ... user codes ...
const session = recorder.stop(); // events + initial/final content
```

**Play back:**

```ts
import { PlaybackEngine } from '@thisisayande/openscrim-core';
import { attachPlayback } from '@thisisayande/openscrim-monaco';

const engine = new PlaybackEngine();
attachPlayback(editor, monaco, engine, {
  onContentRendered: (content) => setCode(content), // keep React state in sync
});
engine.loadSession(session);
engine.play();
```

| Package | What it is |
| --- | --- |
| [`@thisisayande/openscrim-core`](https://www.npmjs.com/package/@thisisayande/openscrim-core) | Framework-agnostic engine: event model, `RecordingManager`, `PlaybackEngine`, compression, `.tantrica` file format. No React, no Monaco. |
| [`@thisisayande/openscrim-monaco`](https://www.npmjs.com/package/@thisisayande/openscrim-monaco) | Monaco binding: `MonacoRecorder` + `attachPlayback`. Monaco is a type-only peer dep — adds no editor copy to your bundle. |
| [`@thisisayande/openscrim-player`](https://www.npmjs.com/package/@thisisayande/openscrim-player) | Drop-in player: script-tag embed or `createPlayer(div, { src })`. Loads Monaco from a CDN at runtime; ~24 KB bundle. |

## Run the web app

The repo also contains a full Next.js studio: recording UI, playback viewer with fork-to-edit, a recording library, and shareable links.

```bash
git clone https://github.com/ayan-de/openscrim.git
cd openscrim
pnpm install
```

**Fastest start — fully local, no backend:** create `apps/web/.env.local` with

```
NEXT_PUBLIC_LOCAL_ONLY=true
```

Recordings are stored in your browser's IndexedDB; no database or auth needed.

**Full setup (cloud sync + Google sign-in):** set these in `apps/web/.env.local` instead:

```
MONGODB_URI=...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
AUTH_SECRET=...
```

Then:

```bash
pnpm dev          # all packages (web app on http://localhost:3000)
pnpm build        # build everything
pnpm check-types  # typecheck
```

## Repo structure

```
packages/openscrim-core     # domain engine (published to npm)
packages/openscrim-monaco   # Monaco binding (published to npm)
packages/openscrim-player   # drop-in embed player (published to npm)
apps/web                    # Next.js 15 studio: record, play, fork, share
```

Built with pnpm + Turborepo. After editing `packages/*/src`, run `pnpm build` — the web app resolves packages via their compiled `dist/`.

## Roadmap

- [x] Drop-in embed player (`<script>` tag + one div) for blogs, docs, and course sites
- [ ] Format spec published as a standalone document
- [ ] Audio track synced to the event timeline
- [ ] Hosted cloud for teachers: share links, analytics (watch time, drop-off, forks), team workspaces
- [ ] In-browser code execution for playback previews
- [ ] LTI 1.3 integration (Canvas/Moodle) for classrooms

## Contributing

Issues and PRs are welcome. The codebase is TypeScript end-to-end; start with [`packages/openscrim-core/src/types.ts`](packages/openscrim-core/src/types.ts) to understand the event model everything is built on.

## License

[MIT](./LICENSE) © Ayan De
