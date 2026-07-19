---
'@thisisayande/openscrim-core': patch
---

`compressEvents` no longer drops intermediate `content_change` events. Content changes are deltas, not snapshots, so collapsing a burst to its last event corrupted the replayed document (e.g. typing "abc" quickly kept only the "c" delta). Cursor, scroll, and pointer-move dedup is unchanged — those events are absolute and safe to collapse.
