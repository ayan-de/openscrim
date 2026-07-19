# @thisisayande/openscrim-core

The engine behind [OpenScrim](https://github.com/ayan-de/openscrim) — an open-source, Scrimba-style format for **interactive code screencasts**. Instead of recording pixels, OpenScrim records editor events (keystrokes, cursor moves, content changes, scrolls) as timestamped data, so a "video" of a coding session is ~100× smaller than pixel video, fully seekable, and **forkable**: viewers can pause at any moment and edit the instructor's exact code.

This package is framework-agnostic (no React, no Monaco dependency). For wiring it to a Monaco editor, see [`@thisisayande/openscrim-monaco`](https://www.npmjs.com/package/@thisisayande/openscrim-monaco).

## Install

```bash
npm install @thisisayande/openscrim-core
```

## What's inside

- **`RecordingManager`** — captures editor events into a `RecordingSession` buffer
- **`PlaybackEngine`** — schedules and replays events with play/pause/seek/speed; emits events to your renderer via handler callbacks
- **`compressEvents` / `decompressEvents`** — event-stream compression (cursor dedup, keystroke batching)
- **`sessionToTantricaFile` / `writeTantricaBuffer` / `readTantricaBuffer`** — the `.tantrica` file format: gzipped JSON with magic bytes and a fast-readable metadata header
- **`types`** — the full `RecordingEvent` union and `RecordingSession` model

## Quick example

```ts
import { PlaybackEngine } from '@thisisayande/openscrim-core';

const engine = new PlaybackEngine();
engine.addEventHandler(({ type, data }) => {
  if (type === 'eventProcessed') renderIntoYourEditor(data);
});
engine.loadSession(session);

engine.play();
engine.seek(30_000); // jump to 0:30
engine.setSpeed(1.5);
```

## Environment notes

- Recording, playback, and event compression work in **browsers and Node**.
- **Reading** `.tantrica` files works everywhere: `parseTantricaBytes(bytes)` is async and uses Web APIs only (`DecompressionStream`), so it runs in browsers and Node 18+.
- The synchronous binary helpers (`writeTantricaBuffer` / `readTantricaBuffer`) require **Node** (they use `zlib` and `Buffer`); use them server-side. Plain-JSON serialization works everywhere.

## Status

`0.x` — APIs and the file format may still change between minor versions. Feedback and issues welcome at [github.com/ayan-de/openscrim](https://github.com/ayan-de/openscrim/issues).

## License

MIT © Ayan De
