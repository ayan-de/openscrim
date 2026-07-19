---
'@thisisayande/openscrim-core': minor
---

Add `parseTantricaBytes(bytes)` — an async `.tantrica` parser built on Web APIs only (`DecompressionStream`, `DataView`, `TextDecoder`). Works in browsers and Node 18+, no `Buffer` or `zlib` required. Accepts both the binary format and plain JSON.
