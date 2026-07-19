# @thisisayande/openscrim-player

Drop-in player for [OpenScrim](https://github.com/ayan-de/openscrim) interactive code screencasts. One script tag (or one function call) turns a div into a scrim player: play/pause, seek, speed control, a live pointer trail — and when paused, the viewer can **edit the instructor's exact code** right in the player.

Monaco is lazy-loaded from a CDN at runtime, so you don't need a bundler, a Monaco setup, or any build step.

## Script tag (no build tools)

```html
<div data-openscrim-src="/recordings/intro.tantrica" data-height="420px"></div>
<script src="https://cdn.jsdelivr.net/npm/@thisisayande/openscrim-player/dist/embed.global.js"></script>
```

Optional attributes: `data-autoplay`, `data-speed="1.5"`, `data-theme="light"`, `data-height="400px"`.

## As a module

```bash
npm install @thisisayande/openscrim-player
```

```ts
import { createPlayer } from '@thisisayande/openscrim-player';

const player = await createPlayer(document.getElementById('demo')!, {
  src: '/recordings/intro.tantrica', // or pass `session` / `file` directly
  theme: 'dark',
  autoplay: false,
});

player.seek(30_000);
player.setSpeed(1.5);
player.destroy();
```

If your page already ships `monaco-editor`, pass it via `options.monaco` to skip the CDN load; `options.monacoVsPath` overrides where Monaco is fetched from.

## Recording format

The player accepts binary `.tantrica` files and their plain-JSON equivalent, served from any static host. Recordings are produced with [`@thisisayande/openscrim-monaco`](https://www.npmjs.com/package/@thisisayande/openscrim-monaco) or the [OpenScrim studio](https://github.com/ayan-de/openscrim).

Note: serve `.tantrica` files with any content type — the player sniffs magic bytes, not MIME.

## Status

`0.x` — APIs may change between minor versions. Issues welcome at [github.com/ayan-de/openscrim](https://github.com/ayan-de/openscrim/issues).

## License

MIT © Ayan De
