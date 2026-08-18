# Screen Share Recording — Design Spec

## Goal

Let a teacher record a browser tab/window/screen (e.g. searching Google, reading docs,
explaining in Excalidraw) alongside an editor recording session. Playback shows it as a
non-interactive picture-in-picture video overlaid on the editor, synced by timestamp.

## Use Case

Teaching — instructor briefly leaves the editor to search docs or draw a diagram in
another tab. Students watching the recording see that browser activity in a small
floating video window while the editor replay continues underneath.

## Scope

| In scope                                          | Out of scope (follow-up)         |
| -------------------------------------------------- | --------------------------------- |
| Tab/window/screen capture via `getDisplayMedia`    | Trimming/editing the video        |
| WebM recording via `MediaRecorder`                 | Multiple share segments/session   |
| Storage: IndexedDB (local) + object storage (API)  | Audio narration (see separate audio spec) |
| Timestamp-synced, non-interactive PiP playback     | Interactive/clickable overlay     |
| Draggable/resizable overlay, editor stays visible  | Picture-in-picture browser API (`requestPictureInPicture`) |
| Graceful no-op if teacher cancels the share prompt |  |

## Decisions

- **Capture trigger**: one "Start Recording" click starts both editor recording and
  `getDisplayMedia()`. Cancelling the OS share picker does not block or fail editor
  recording — it just proceeds without video.
- **Capture format**: `MediaRecorder` → WebM (`video/webm`), no audio track captured
  from the share (`audio: false`) — avoids overlapping with a future audio-narration
  track.
- **Sync strategy**: single offset, not embedded in `.scrim`. Video is a sibling
  artifact keyed by `sessionId`; `screenShareOffsetMs` (ms between session start and
  the moment `MediaRecorder` actually started) is the only link between the two
  timelines. No `.scrim`/`RecordingEvent`/`RecordingManager` changes.
- **Storage**: Blob stored directly in a new IndexedDB object store locally; mirrored
  to object storage (presigned PUT) via a new API route when the user is authenticated
  — same always-local / best-effort-remote pattern `SmartStorageAdapter` already uses
  for everything else.
- **Playback UI**: draggable/resizable PiP `<video>`, modeled on the existing
  `FloatingPreviewWindow` component, default bottom-right, non-interactive (no seek
  bar of its own — driven entirely by the editor's playback clock).

## Architecture

Three components, mirroring the existing audio-recording design's shape:

1. **Recording capture** (`apps/web/app/hooks/useScreenShare.ts`, new) — owns
   `getDisplayMedia` + `MediaRecorder` lifecycle, called from `useRecordings.ts`
   alongside the existing `RecordingManager.start()/stop()`.
2. **Storage** — `RecordingStorage` interface gets an optional
   `saveVideo(id, blob, offsetMs)` / `getVideoUrl(id)` pair, implemented in
   `IndexedDBStorageAdapter`, `ApiStorageAdapter`, and passed through by
   `SmartStorageAdapter`.
3. **Playback overlay** — `ScreenShareOverlay.tsx` (new), rendered by
   `PlaybackViewer`/`ScrimPlayer` when the loaded session has a video track.

## Recording Flow

```
1. Teacher clicks "Start Recording"
2. useRecordings.startRecording():
   → RecordingManager.start()   (existing, unchanged)
   → useScreenShare.start():
       navigator.mediaDevices.getDisplayMedia({ video: true, audio: false })
       → on success: new MediaRecorder(stream, { mimeType: 'video/webm' })
                      .start(); record screenShareOffsetMs = Date.now() - session.startTime
       → on user cancel (NotAllowedError): no-op, editor-only recording continues
3. Teacher stops recording:
   → RecordingManager.stop()    (existing, unchanged)
   → useScreenShare.stop() → MediaRecorder.stop() → resolves a Blob (video/webm)
4. If a Blob was produced:
   → storage.saveVideo(sessionId, blob, screenShareOffsetMs)
```

If the display surface is closed early by the teacher (browser's native
"Stop sharing" control), the `MediaRecorder`'s `stop` event fires — treat that
identically to step 3's stop and finalize whatever was captured up to that point;
editor recording is unaffected and keeps running.

## Storage

### `RecordingStorage` interface additions (`apps/web/app/lib/storage/types.ts`)

```typescript
saveVideo?(recordingId: string, blob: Blob, offsetMs: number): Promise<void>;
getVideoUrl?(recordingId: string): Promise<string | null>; // object URL (local) or signed URL (API)
```

Optional methods — recordings without a video track never call these.

### `IndexedDBStorageAdapter`

- New object store, e.g. `videos`, keyed by `recordingId`, storing `{ blob, offsetMs }`.
  IndexedDB stores `Blob`s natively — no base64/serialization needed.
- `getVideoUrl` does `URL.createObjectURL(blob)`; caller revokes it on unmount.

### `ApiStorageAdapter`

- `saveVideo` POSTs the blob (multipart or raw body) to a new
  `api/recordings/[id]/video` route.
- Route handler follows the existing `api/recordings/upload/route.ts` pattern:
  `auth()` guard → stream to object storage via presigned PUT
  (new `lib/objectStorage.ts`, S3-compatible) → write `videoKey` and
  `screenShareOffsetMs` onto the `Recording` Mongoose doc as new optional fields
  (no migration needed; existing docs simply lack them).
- `getVideoUrl` fetches/returns a signed GET URL for the stored object.

### `SmartStorageAdapter`

- `saveVideo`: always write to IndexedDB; if authenticated, also best-effort mirror
  to the API (same fire-and-forget pattern as other saves — failure doesn't block
  the local save).
- `getVideoUrl`: local first, falls back to API — same read pattern already used
  for recording content.

### Anonymous/local-only users

Full feature works entirely offline via IndexedDB; nothing changes for
`NEXT_PUBLIC_LOCAL_ONLY=true` mode.

## Playback — `ScreenShareOverlay`

### Component

New `ScreenShareOverlay.tsx`, structurally close to the existing
`FloatingPreviewWindow.tsx` (same drag/resize-by-edge interaction), swapping the
iframe for a `<video muted playsInline>` element sourced from `getVideoUrl()`.

### Sync

No independent playback controls. Driven by the same clock the editor replay uses:

```
on playback position change (currentTime, isPlaying):
  video.currentTime = clamp((currentTime - screenShareOffsetMs) / 1000, 0, video.duration)
  if isPlaying: video.play() else: video.pause()
```

- Before `screenShareOffsetMs` is reached, the overlay is hidden (nothing was being
  shared yet).
- After the video's own duration ends but the editor recording continues, the overlay
  shows the video's last frame (native `<video>` behavior) rather than disappearing —
  keeps it simple, no fade logic.
- Seeking the editor scrubber sets `video.currentTime` directly (no buffering UI needed
  for local blobs/short clips).

### UI

- Rendered only when the loaded session/recording has a video track.
- Default position bottom-right of the editor viewport, draggable/resizable, editor
  fully visible and interactive underneath at all times.
- No play/pause/seek controls on the overlay itself — purely a mirror of editor state.

## Edge Cases

| Case                                       | Behavior                                             |
| ------------------------------------------- | ----------------------------------------------------- |
| Teacher cancels share picker                | Editor-only recording proceeds, no overlay on playback |
| Teacher stops sharing early (native control)| Video finalized up to that point; editor keeps recording |
| Video shorter than editor recording         | Overlay freezes on last frame after video ends         |
| Video longer than editor recording          | Not possible — `MediaRecorder` stops when editor recording stops |
| No video track on a recording               | Overlay never renders                                  |
| Playback seek to before offset              | Overlay hidden                                         |
| Fork of a recording with video               | Video track is not carried into forks (forks are edit sessions off editor content only) |

## Pre-requisite Checklist

- [ ] `RecordingStorage` interface: add optional `saveVideo`/`getVideoUrl`
- [ ] `IndexedDBStorageAdapter`: new `videos` object store
- [ ] `ApiStorageAdapter`: `saveVideo`/`getVideoUrl` calling new API route
- [ ] `SmartStorageAdapter`: wire local + best-effort remote mirroring
- [ ] New route `api/recordings/[id]/video` (auth guard, object storage PUT)
- [ ] `lib/objectStorage.ts` — presigned PUT/GET helper
- [ ] `Recording` Mongoose model: add optional `videoKey`, `screenShareOffsetMs`
- [ ] `useScreenShare.ts` hook, wired into `useRecordings.ts` start/stop
- [ ] `ScreenShareOverlay.tsx`, wired into `PlaybackViewer`/`ScrimPlayer`
- [ ] Build + type-check passes

## Future

- Generalize the single `videoKey` into a `mediaTracks[]` array so audio narration
  and screen share can coexist per recording (same direction the audio spec's
  `MediaTrack` type was already pointed at).
- Multiple share segments per session (pause/resume sharing mid-recording).
