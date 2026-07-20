# @thisisayande/openscrim-react

React SDK for [OpenScrim](https://github.com/ayan-de/openscrim) — record and replay interactive, forkable code screencasts with a Monaco editor. Ships drop-in `<ScrimRecorder>` / `<ScrimPlayer>` components **and** the headless `useRecorder` / `usePlayer` hooks underneath them.

The SDK is deliberately unopinionated: it owns the editor, the recording engine, and the playback engine — **you** own storage, auth, and networking. A finished recording is handed back through `onComplete`; where it goes (IndexedDB, your API, the OpenScrim cloud, a `.tantrica` download) is your call.

## Install

```bash
npm install @thisisayande/openscrim-react @monaco-editor/react monaco-editor
```

`react`, `react-dom`, `@monaco-editor/react`, and `monaco-editor` are peer dependencies — the SDK uses whatever the host app already ships.

## Record

```tsx
import { ScrimRecorder } from '@thisisayande/openscrim-react';

<ScrimRecorder
  language="typescript"
  defaultValue="// teach something\n"
  title="Intro to generics"
  height="480px"
  onComplete={(session) => {
    // persist however you like — the SDK never touches your backend
    localStorage.setItem(session.id, JSON.stringify(session));
  }}
/>;
```

## Play (and fork)

```tsx
import { ScrimPlayer } from '@thisisayande/openscrim-react';

// from a URL, a parsed .tantrica file, or an in-memory session
<ScrimPlayer src="/recordings/intro.tantrica" autoplay speed={1.5} />;
```

Pause and the viewer can edit the instructor's exact code; press play and the canonical stream resumes.

## Go headless

Want your own chrome? Use the hooks and render Monaco yourself.

```tsx
import { Editor } from '@monaco-editor/react';
import { usePlayer } from '@thisisayande/openscrim-react';

function Player({ session }) {
  const p = usePlayer({ session, onPointer: (e) => drawCursor(e.x, e.y) });
  return (
    <>
      <Editor onMount={p.onMount} options={{ readOnly: true }} />
      <button onClick={p.isPlaying ? p.pause : p.play}>
        {p.isPlaying ? 'Pause' : 'Play'}
      </button>
    </>
  );
}
```

Both components also accept a `children` render-prop that receives the live hook API, so you can keep the editor but swap the controls.

## Status

`0.x` — APIs may change between minor versions. Issues welcome at [github.com/ayan-de/openscrim](https://github.com/ayan-de/openscrim/issues).

## License

MIT © Ayan De
