# @thisisayande/openscrim-core

## 0.2.0

### Minor Changes

- e5277a8: Add `parseTantricaBytes(bytes)` — an async `.tantrica` parser built on Web APIs only (`DecompressionStream`, `DataView`, `TextDecoder`). Works in browsers and Node 18+, no `Buffer` or `zlib` required. Accepts both the binary format and plain JSON.

### Patch Changes

- 15792e3: `compressEvents` no longer drops intermediate `content_change` events. Content changes are deltas, not snapshots, so collapsing a burst to its last event corrupted the replayed document (e.g. typing "abc" quickly kept only the "c" delta). Cursor, scroll, and pointer-move dedup is unchanged — those events are absolute and safe to collapse.
