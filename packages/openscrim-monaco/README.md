# @thisisayande/openscrim-monaco

Monaco editor binding for [OpenScrim](https://github.com/ayan-de/openscrim) — record and replay **interactive, forkable code screencasts** in any Monaco host. Instead of pixel video, OpenScrim records editor events as timestamped data: tiny files, instant seek, and viewers can pause anywhere and edit the instructor's exact code.

Works with any `monaco-editor` instance (plain Monaco, `@monaco-editor/react`, custom hosts). `monaco-editor` is a peer dependency and is only imported as types — this package adds no Monaco copy to your bundle.

## Install

```bash
npm install @thisisayande/openscrim-monaco monaco-editor
```

## Record

```ts
import { MonacoRecorder } from '@thisisayande/openscrim-monaco';

const recorder = new MonacoRecorder(editor, monaco);
recorder.start();
// ... user codes ...
const session = recorder.stop(); // RecordingSession: events + initial/final content
```

## Play back

```ts
import { PlaybackEngine } from '@thisisayande/openscrim-core';
import { attachPlayback } from '@thisisayande/openscrim-monaco';

const engine = new PlaybackEngine();
attachPlayback(editor, monaco, engine, {
  // React hosts that mirror editor content into state MUST sync via this
  // callback, or a stale `value` prop will clobber applied edits.
  onContentRendered: (content) => setCode(content),
});

engine.loadSession(session);
engine.play();
```

## Status

`0.x` — APIs may still change between minor versions. Issues and feedback welcome at [github.com/ayan-de/openscrim](https://github.com/ayan-de/openscrim/issues).

## License

MIT © Ayan De
