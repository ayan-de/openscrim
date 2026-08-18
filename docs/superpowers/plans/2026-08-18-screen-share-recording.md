# Screen Share Recording Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a teacher record a browser tab/window/screen (`getDisplayMedia`) alongside
an editor recording, and show it as a non-interactive, draggable/resizable
picture-in-picture video during playback, synced by timestamp offset.

**Architecture:** The video is a sibling artifact to the `.scrim` session, joined only
by a `screenShareOffsetMs` field on `RecordingSession`. No `RecordingManager`,
`.scrim` format, or `RecordingEvent` changes. Capture uses `MediaRecorder` → WebM.
Storage: a new IndexedDB object store locally, GridFS (native MongoDB, no external
service) via a new API route when authenticated. Playback renders a PiP `<video>`
overlay modeled on the existing `FloatingPreviewWindow` drag/resize pattern, driven
by the same clock as `PlaybackEngine`.

**Tech Stack:** Next.js 15 App Router, `getDisplayMedia`/`MediaRecorder` (browser),
IndexedDB, Mongoose + MongoDB GridFS, existing `openscrim-core`/`openscrim-monaco`
packages.

**Spec:** `docs/superpowers/specs/2026-08-18-screen-share-recording-design.md`

## Global Constraints

- No `.scrim`/`RecordingEvent`/`RecordingManager`/`format.ts` changes — video stays a
  sibling artifact linked only by timestamp offset.
- No new external services or env vars — video storage is GridFS on the existing
  `MONGODB_URI` connection (per updated storage decision; supersedes the spec's
  "object storage" wording, which assumed S3-style infra that doesn't exist here).
- `getDisplayMedia`/`MediaRecorder` capture no audio (`audio: false`).
- Cancelling the OS share picker must never block or fail editor recording.
- This repo has no test runner configured. Pure logic (offset/clamp math) gets a
  `node --test` check (Node's built-in test runner, zero new deps). Browser-only code
  (hooks using `getDisplayMedia`/`MediaRecorder`, React components) gets explicit
  manual browser verification steps instead, matching the rest of this codebase.
- After editing `packages/openscrim-core/src`, rebuild it
  (`pnpm exec turbo build --filter=@thisisayande/openscrim-core`) before the web app
  picks up the change.

---

### Task 1: Core type — `screenShareOffsetMs` on `RecordingSession`

**Files:**
- Modify: `packages/openscrim-core/src/types.ts:148-170` (`RecordingSession` interface)

**Interfaces:**
- Produces: `RecordingSession.screenShareOffsetMs?: number` — ms between session
  start and the moment screen capture actually started. Absent/undefined means no
  screen share track exists for this recording.

- [ ] **Step 1: Add the field**

In `packages/openscrim-core/src/types.ts`, inside `export interface RecordingSession`
(currently ending at line 170 with `createdAt`/`updatedAt`/`metadata`), add:

```typescript
export interface RecordingSession {
  id: string;
  title: string;
  description?: string;
  language: string;
  initialContent: string;
  finalContent: string;
  duration: number;
  events: RecordingEvent[];
  files?: Record<string, string>;
  /**
   * Milliseconds between session start and when screen-share capture began.
   * Present only when a screen recording exists for this session; the video
   * itself lives in RecordingStorage (IndexedDB locally, GridFS via the API),
   * keyed by the session id — not embedded in this type or the .scrim file.
   */
  screenShareOffsetMs?: number;
  createdAt: Date;
  updatedAt: Date;
  metadata?: {
    editorTheme?: string;
    fontSize?: number;
    tabSize?: number;
    [key: string]: string | number | boolean | undefined;
  };
  // ...rest unchanged
}
```

- [ ] **Step 2: Build the core package**

Run: `pnpm exec turbo build --filter=@thisisayande/openscrim-core`
Expected: build succeeds, no type errors.

- [ ] **Step 3: Commit**

```bash
git add packages/openscrim-core/src/types.ts
git commit -m "feat(core): add screenShareOffsetMs to RecordingSession"
```

---

### Task 2: `useScreenShare` capture hook

**Files:**
- Create: `apps/web/app/hooks/useScreenShare.ts`
- Create: `apps/web/app/hooks/screenShareOffset.ts` (pure helper, testable)
- Test: `apps/web/app/hooks/screenShareOffset.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces:
  - `computeOffsetMs(sessionStartTime: number, captureStartTime: number): number` —
    pure function, clamps negative results to 0.
  - `useScreenShare(): { start(sessionStartTime: number): Promise<void>; stop(): Promise<{ blob: Blob; offsetMs: number } | null>; isSharing: boolean }`
    — `start` is a no-op (resolves, `isSharing` stays false) if the user cancels the
    OS share picker (`NotAllowedError`/`AbortError`) or the browser lacks
    `getDisplayMedia`. `stop` resolves `null` if no share was ever started.

- [ ] **Step 1: Write the failing test for the pure helper**

```typescript
// apps/web/app/hooks/screenShareOffset.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeOffsetMs } from './screenShareOffset';

test('computes positive offset from session start to capture start', () => {
  assert.equal(computeOffsetMs(1000, 1500), 500);
});

test('clamps negative offsets to 0 (capture reported before session start)', () => {
  assert.equal(computeOffsetMs(1500, 1000), 0);
});

test('zero offset when capture starts exactly at session start', () => {
  assert.equal(computeOffsetMs(1000, 1000), 0);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test --experimental-strip-types apps/web/app/hooks/screenShareOffset.test.ts`
Expected: FAIL — `screenShareOffset.ts` does not exist yet.

- [ ] **Step 3: Implement the pure helper**

```typescript
// apps/web/app/hooks/screenShareOffset.ts
/** Ms between session start and when screen capture actually began, never negative. */
export function computeOffsetMs(
  sessionStartTime: number,
  captureStartTime: number
): number {
  return Math.max(0, captureStartTime - sessionStartTime);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test --experimental-strip-types apps/web/app/hooks/screenShareOffset.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Implement `useScreenShare`**

```typescript
// apps/web/app/hooks/useScreenShare.ts
'use client';

import { useCallback, useRef, useState } from 'react';
import { computeOffsetMs } from './screenShareOffset';

export interface UseScreenShareReturn {
  isSharing: boolean;
  start: (sessionStartTime: number) => Promise<void>;
  stop: () => Promise<{ blob: Blob; offsetMs: number } | null>;
}

export function useScreenShare(): UseScreenShareReturn {
  const [isSharing, setIsSharing] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const offsetRef = useRef<number>(0);

  const start = useCallback(async (sessionStartTime: number) => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getDisplayMedia) {
      return;
    }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      });
    } catch {
      // User cancelled the share picker, or permission denied — editor-only
      // recording continues unaffected.
      return;
    }

    streamRef.current = stream;
    chunksRef.current = [];
    offsetRef.current = computeOffsetMs(sessionStartTime, Date.now());

    const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    // Native "Stop sharing" browser control ends the video track; finalize
    // whatever was captured instead of leaving the recorder dangling.
    stream.getVideoTracks()[0]?.addEventListener('ended', () => {
      if (recorder.state !== 'inactive') recorder.stop();
    });

    recorder.start();
    recorderRef.current = recorder;
    setIsSharing(true);
  }, []);

  const stop = useCallback(async () => {
    const recorder = recorderRef.current;
    if (!recorder) return null;

    const blob = await new Promise<Blob>((resolve) => {
      recorder.onstop = () => {
        resolve(new Blob(chunksRef.current, { type: 'video/webm' }));
      };
      if (recorder.state !== 'inactive') recorder.stop();
      else resolve(new Blob(chunksRef.current, { type: 'video/webm' }));
    });

    streamRef.current?.getTracks().forEach((t) => t.stop());
    recorderRef.current = null;
    streamRef.current = null;
    setIsSharing(false);

    return { blob, offsetMs: offsetRef.current };
  }, []);

  return { isSharing, start, stop };
}
```

- [ ] **Step 6: Manual browser verification**

Run: `pnpm exec turbo dev --filter=web`
In a browser at `localhost:3000`, temporarily call `useScreenShare` from any client
component (or wait for Task 3's wiring) and confirm: clicking share → picker opens →
selecting a tab starts `isSharing`; cancelling the picker leaves `isSharing` false
with no console error; clicking the native "Stop sharing" pill also flips
`isSharing` back to false.

- [ ] **Step 7: Commit**

```bash
git add apps/web/app/hooks/screenShareOffset.ts apps/web/app/hooks/screenShareOffset.test.ts apps/web/app/hooks/useScreenShare.ts
git commit -m "feat(web): add useScreenShare capture hook"
```

---

### Task 3: `RecordingStorage` interface + `IndexedDBStorageAdapter` video store

**Files:**
- Modify: `apps/web/app/lib/storage/types.ts`
- Modify: `apps/web/app/lib/recordingStorage.ts` (bump `DB_VERSION`, add object store)
- Modify: `apps/web/app/lib/storage/IndexedDBStorageAdapter.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks (independent of Task 2).
- Produces:
  - `RecordingStorage.saveVideo?(recordingId: string, blob: Blob, offsetMs: number): Promise<void>`
  - `RecordingStorage.getVideoUrl?(recordingId: string): Promise<string | null>`
    (returns an `URL.createObjectURL` blob URL for local storage; caller revokes it)

- [ ] **Step 1: Extend the interface**

```typescript
// apps/web/app/lib/storage/types.ts
export interface RecordingStorage {
  save(session: RecordingSession): Promise<void>;
  load(id: string): Promise<RecordingSession | null>;
  list(page?: number, limit?: number): Promise<RecordingListResult>;
  delete(id: string): Promise<void>;
  getEvents(id: string): Promise<RecordingEvent[]>;
  /** Optional: recordings without a screen-share track never call these. */
  saveVideo?(recordingId: string, blob: Blob, offsetMs: number): Promise<void>;
  getVideoUrl?(recordingId: string): Promise<string | null>;
}
```

- [ ] **Step 2: Add the IndexedDB video store**

In `apps/web/app/lib/recordingStorage.ts`, bump the version and add the store:

```typescript
const DB_NAME = 'tantrica_recordings';
const STORE_NAME = 'recordings';
const VIDEO_STORE_NAME = 'videos';
const DB_VERSION = 2;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(VIDEO_STORE_NAME)) {
        db.createObjectStore(VIDEO_STORE_NAME, { keyPath: 'recordingId' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveVideoBlob(
  recordingId: string,
  blob: Blob,
  offsetMs: number
): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(VIDEO_STORE_NAME, 'readwrite');
    tx.objectStore(VIDEO_STORE_NAME).put({ recordingId, blob, offsetMs });
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => reject(tx.error);
  });
}

export async function getVideoBlob(
  recordingId: string
): Promise<{ blob: Blob; offsetMs: number } | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(VIDEO_STORE_NAME, 'readonly');
    const request = tx.objectStore(VIDEO_STORE_NAME).get(recordingId);
    request.onsuccess = () => {
      resolve(
        request.result
          ? { blob: request.result.blob, offsetMs: request.result.offsetMs }
          : null
      );
    };
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
  });
}
```

Keep the existing `saveRecording`/`getRecording`/`getAllRecordings`/
`deleteRecording`/`countRecordings` exports unchanged — this only adds the new
store and two new exports alongside them. Existing databases upgrade in place;
`onupgradeneeded` only adds the store if missing, so current users' `recordings`
store and its data are untouched.

- [ ] **Step 3: Wire into `IndexedDBStorageAdapter`**

```typescript
// apps/web/app/lib/storage/IndexedDBStorageAdapter.ts
import type { RecordingSession, RecordingEvent } from '@thisisayande/openscrim-core';
import type { RecordingStorage, RecordingListResult } from './types';
import {
  saveRecording,
  getRecording,
  getAllRecordings,
  deleteRecording as deleteRecordingDB,
  saveVideoBlob,
  getVideoBlob,
} from '@/lib/recordingStorage';

export class IndexedDBStorageAdapter implements RecordingStorage {
  // ...existing save/load/list/delete/getEvents unchanged...

  async saveVideo(recordingId: string, blob: Blob, offsetMs: number): Promise<void> {
    await saveVideoBlob(recordingId, blob, offsetMs);
  }

  async getVideoUrl(recordingId: string): Promise<string | null> {
    const result = await getVideoBlob(recordingId);
    return result ? URL.createObjectURL(result.blob) : null;
  }
}
```

- [ ] **Step 4: Manual verification**

Run: `pnpm exec turbo dev --filter=web`. In the browser console on any page:
```js
const { saveVideoBlob, getVideoBlob } = await import('/app/lib/recordingStorage.ts');
await saveVideoBlob('test-id', new Blob(['x'], { type: 'video/webm' }), 500);
await getVideoBlob('test-id'); // → { blob: Blob, offsetMs: 500 }
```
Expected: round-trips correctly; DevTools → Application → IndexedDB shows a
`videos` object store under `tantrica_recordings`.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/lib/storage/types.ts apps/web/app/lib/recordingStorage.ts apps/web/app/lib/storage/IndexedDBStorageAdapter.ts
git commit -m "feat(web): add video storage to IndexedDBStorageAdapter"
```

---

### Task 4: GridFS video storage + API route + `ApiStorageAdapter`

**Files:**
- Create: `apps/web/app/lib/videoStorage.ts`
- Modify: `apps/web/app/lib/models/Recording.ts` (add `screenShareOffsetMs`, `videoFileId`)
- Create: `apps/web/app/api/recordings/[id]/video/route.ts`
- Modify: `apps/web/app/lib/storage/ApiStorageAdapter.ts`
- Modify: `apps/web/app/lib/recordingsApi.ts` (`RecordingFromApi` +
  `convertApiRecordingToSession` — the offset must flow from the Mongo doc back
  onto the `RecordingSession` object, or Task 7's overlay will never know an
  API-loaded session has a video)

**Interfaces:**
- Consumes: `RecordingStorage.saveVideo`/`getVideoUrl` signatures from Task 3.
- Produces:
  - `saveVideoToGridFS(recordingId: string, buffer: Buffer): Promise<Types.ObjectId>`
  - `streamVideoFromGridFS(fileId: Types.ObjectId): NodeJS.ReadableStream`
  - `deleteVideoFromGridFS(fileId: Types.ObjectId): Promise<void>`

- [ ] **Step 1: GridFS helper**

```typescript
// apps/web/app/lib/videoStorage.ts
import mongoose, { Types } from 'mongoose';
import { connectToDatabase } from './mongodb';

const BUCKET_NAME = 'screenShareVideos';

async function getBucket() {
  await connectToDatabase();
  const db = mongoose.connection.db;
  if (!db) throw new Error('Database not connected');
  return new mongoose.mongo.GridFSBucket(db, { bucketName: BUCKET_NAME });
}

export async function saveVideoToGridFS(
  recordingId: string,
  buffer: Buffer
): Promise<Types.ObjectId> {
  const bucket = await getBucket();
  return new Promise((resolve, reject) => {
    const uploadStream = bucket.openUploadStream(`${recordingId}.webm`, {
      contentType: 'video/webm',
    });
    uploadStream.on('error', reject);
    uploadStream.on('finish', () => resolve(uploadStream.id as Types.ObjectId));
    uploadStream.end(buffer);
  });
}

export async function streamVideoFromGridFS(fileId: Types.ObjectId) {
  const bucket = await getBucket();
  return bucket.openDownloadStream(fileId);
}

export async function deleteVideoFromGridFS(fileId: Types.ObjectId): Promise<void> {
  const bucket = await getBucket();
  await bucket.delete(fileId).catch(() => {
    // Already gone — deleting a recording twice shouldn't throw.
  });
}
```

- [ ] **Step 2: Add fields to the `Recording` model**

In `apps/web/app/lib/models/Recording.ts`, add two optional fields to the schema:

```typescript
    isPublic: { type: Boolean, default: false },
    playCount: { type: Number, default: 0 },
    screenShareOffsetMs: { type: Number },
    videoFileId: { type: Types.ObjectId },
```

(Existing documents lack these fields — Mongoose treats them as `undefined`, no
migration needed.)

- [ ] **Step 3: Video API route**

```typescript
// apps/web/app/api/recordings/[id]/video/route.ts
import { NextResponse } from 'next/server';
import { Types } from 'mongoose';
import { auth } from '@/lib/auth';
import { connectToDatabase } from '@/lib/mongodb';
import RecordingModel from '@/lib/models/Recording';
import {
  saveVideoToGridFS,
  streamVideoFromGridFS,
  deleteVideoFromGridFS,
} from '@/lib/videoStorage';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?._id) {
    return NextResponse.json(
      { status: 401, code: 'UNAUTHORIZED', message: 'Not authenticated' },
      { status: 401 }
    );
  }

  const { id } = await params;
  await connectToDatabase();

  const recording = await RecordingModel.findById(id);
  if (!recording || recording.userId.toString() !== session.user._id) {
    return NextResponse.json(
      { status: 404, code: 'NOT_FOUND', message: 'Recording not found' },
      { status: 404 }
    );
  }

  const formData = await request.formData();
  const file = formData.get('video');
  const offsetMs = Number(formData.get('offsetMs') ?? 0);
  if (!file || !(file instanceof File)) {
    return NextResponse.json(
      { status: 400, code: 'BAD_REQUEST', message: 'No video uploaded' },
      { status: 400 }
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const fileId = await saveVideoToGridFS(id, buffer);

  recording.videoFileId = fileId;
  recording.screenShareOffsetMs = offsetMs;
  await recording.save();

  return NextResponse.json(
    { status: 200, code: 'OK', message: 'Video saved', data: { fileId: fileId.toString() } },
    { status: 200 }
  );
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await connectToDatabase();

  const recording = await RecordingModel.findById(id);
  if (!recording?.videoFileId) {
    return NextResponse.json(
      { status: 404, code: 'NOT_FOUND', message: 'No video for this recording' },
      { status: 404 }
    );
  }

  const nodeStream = await streamVideoFromGridFS(
    new Types.ObjectId(recording.videoFileId)
  );
  const webStream = new ReadableStream({
    start(controller) {
      nodeStream.on('data', (chunk) => controller.enqueue(chunk));
      nodeStream.on('end', () => controller.close());
      nodeStream.on('error', (err) => controller.error(err));
    },
  });

  return new NextResponse(webStream, {
    headers: { 'Content-Type': 'video/webm' },
  });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?._id) {
    return NextResponse.json(
      { status: 401, code: 'UNAUTHORIZED', message: 'Not authenticated' },
      { status: 401 }
    );
  }

  const { id } = await params;
  await connectToDatabase();
  const recording = await RecordingModel.findById(id);
  if (!recording || recording.userId.toString() !== session.user._id) {
    return NextResponse.json(
      { status: 404, code: 'NOT_FOUND', message: 'Recording not found' },
      { status: 404 }
    );
  }
  if (recording.videoFileId) {
    await deleteVideoFromGridFS(new Types.ObjectId(recording.videoFileId));
    recording.videoFileId = undefined;
    recording.screenShareOffsetMs = undefined;
    await recording.save();
  }
  return NextResponse.json({ status: 200, code: 'OK', message: 'Video deleted' });
}
```

- [ ] **Step 4: Wire `ApiStorageAdapter`**

```typescript
// apps/web/app/lib/storage/ApiStorageAdapter.ts — add:
async saveVideo(recordingId: string, blob: Blob, offsetMs: number): Promise<void> {
  const formData = new FormData();
  formData.append('video', blob, `${recordingId}.webm`);
  formData.append('offsetMs', String(offsetMs));
  const res = await fetch(`/api/recordings/${recordingId}/video`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) throw new Error(`Failed to upload video: ${res.status}`);
}

async getVideoUrl(recordingId: string): Promise<string | null> {
  const res = await fetch(`/api/recordings/${recordingId}/video`, { method: 'HEAD' });
  return res.ok ? `/api/recordings/${recordingId}/video` : null;
}
```

`getVideoUrl` returns the route itself as the `<video src>` — the `GET` handler
streams on demand, no need to fetch+blob it client-side first.

- [ ] **Step 5: Thread the offset back through `convertApiRecordingToSession`**

```typescript
// apps/web/app/lib/recordingsApi.ts — add to RecordingFromApi:
export interface RecordingFromApi {
  // ...existing fields
  screenShareOffsetMs?: number;
}

// and in convertApiRecordingToSession's returned object:
return {
  // ...existing fields
  screenShareOffsetMs: recording.screenShareOffsetMs,
};
```

Without this, a session loaded via `ApiStorageAdapter.load()` would never carry
`screenShareOffsetMs`, and Task 7's overlay would silently never render for
authenticated users even though the video is sitting in GridFS.

- [ ] **Step 6: Manual verification**

Run: `pnpm exec turbo dev --filter=web` with `MONGODB_URI` set (not
`NEXT_PUBLIC_LOCAL_ONLY=true`). Sign in, `POST` a small `.webm` blob to
`/api/recordings/<id>/video` via the browser console using `fetch` +
`FormData`, then `GET` the same URL and confirm the video plays in a `<video>`
tag pointed at it. Confirm `DELETE` clears `videoFileId` on the Mongo doc, and
that `fetchRecording(id)` / `convertApiRecordingToSession` now surfaces
`screenShareOffsetMs` on the resulting session.

- [ ] **Step 7: Commit**

```bash
git add apps/web/app/lib/videoStorage.ts apps/web/app/lib/models/Recording.ts apps/web/app/api/recordings/[id]/video/route.ts apps/web/app/lib/storage/ApiStorageAdapter.ts
git commit -m "feat(api): store screen-share video in GridFS with a video route"
```

---

### Task 5: `SmartStorageAdapter` mirroring + save `screenShareOffsetMs` on the session

**Files:**
- Modify: `apps/web/app/lib/storage/SmartStorageAdapter.ts`

**Interfaces:**
- Consumes: `saveVideo`/`getVideoUrl` from Tasks 3–4.
- Produces: `SmartStorageAdapter.saveVideo`/`getVideoUrl` (same signatures),
  mirroring local-always / remote-when-authenticated exactly like every other
  method on this adapter. The `Recording` doc's `screenShareOffsetMs` and
  `videoFileId` are set entirely by the video route (Task 4) — this task only
  wires the client-side call path to it.

- [ ] **Step 1: Wire `SmartStorageAdapter`**

```typescript
// apps/web/app/lib/storage/SmartStorageAdapter.ts — add:
async saveVideo(recordingId: string, blob: Blob, offsetMs: number): Promise<void> {
  await this.local.saveVideo?.(recordingId, blob, offsetMs);
  if (this.getIsAuthenticated()) {
    await this.api.saveVideo?.(recordingId, blob, offsetMs).catch((err) => {
      console.error('Failed to save video to API:', err);
    });
  }
}

async getVideoUrl(recordingId: string): Promise<string | null> {
  if (this.getIsAuthenticated()) {
    const url = await this.api.getVideoUrl?.(recordingId);
    if (url) return url;
  }
  return this.local.getVideoUrl?.(recordingId) ?? null;
}
```

- [ ] **Step 2: Verify the `RecordingStorage` type still checks out**

Run: `pnpm exec turbo check-types --filter=web`
Expected: passes — `saveVideo`/`getVideoUrl` are optional on the interface, and both
`IndexedDBStorageAdapter` and `ApiStorageAdapter` now implement them, so
`SmartStorageAdapter` calling them with `?.()` type-checks cleanly.

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/lib/storage/SmartStorageAdapter.ts
git commit -m "feat(web): mirror screen-share video save/read through SmartStorageAdapter"
```

---

### Task 6: Wire `useScreenShare` into the recording flow (`MonacoEditor.tsx`)

**Files:**
- Modify: `apps/web/app/components/editor/MonacoEditor.tsx`
- Modify: `apps/web/app/hooks/useRecordings.ts` (expose `sessionState.startTime`
  already present — no change needed there; confirmed via read, `startTime` is on
  `RecordingSessionState`)

**Interfaces:**
- Consumes: `useScreenShare()` from Task 2, `storage.saveVideo` from Task 3/5.
- Produces: screen share starts automatically alongside `startRecording()`; on stop,
  `session.screenShareOffsetMs` is set from `screenShare.stop()`'s result before
  `storage.save(session)` runs, then the blob itself is saved via
  `storage.saveVideo`.

- [ ] **Step 1: Wire the hook into `MonacoEditor.tsx`**

```typescript
// apps/web/app/components/editor/MonacoEditor.tsx
import { useScreenShare } from '@/hooks/useScreenShare';
// ...existing imports

export default function MonacoEditor({ initialTitle = '' }: MonacoEditorProps) {
  // ...existing state
  const screenShare = useScreenShare();
  const pendingOffsetRef = useRef<number>(0);

  const {
    isRecording, isPaused, currentDuration, eventCount,
    startRecording, pauseRecording, resumeRecording, stopRecording,
    handleEditorMount: recordingHandleEditorMount, formatDuration,
    sessionState,
  } = useRecording({
    autoSave: env.AUTO_SAVE_RECORDINGS,
    onSessionComplete: async (session) => {
      try {
        // Stop the share (and get its offset) BEFORE saving the session, so
        // screenShareOffsetMs can be written onto the session object itself —
        // storage.save() serializes whatever is on `session` at call time.
        const shared = await screenShare.stop();
        if (shared) {
          session.screenShareOffsetMs = shared.offsetMs;
        }
        await storage.save(session);
        if (shared) {
          await storage.saveVideo?.(session.id, shared.blob, shared.offsetMs);
        }
        window.dispatchEvent(new CustomEvent('recording_saved'));
      } catch (err) {
        console.error('Failed to save recording:', err);
      }
      showSuccess(
        `Recording saved! Duration: ${formatDuration(session.duration)}, Events: ${session.events.length}`
      );
    },
    onError: (error) => {
      console.error(' Recording error:', error);
      showError(`Recording error: ${error.message}`);
    },
  });

  const handleStartRecording = () => {
    startRecording(sessionTitle);
    // startRecording is synchronous and sets sessionState.startTime before
    // returning (RecordingManager.start() runs inline), so it's available here.
    if (sessionState.startTime) {
      screenShare.start(sessionState.startTime);
    }
  };

  // ...rest unchanged
}
```

Note on ordering: `RecordingManager.start()` sets `startTime` synchronously, but
React state (`sessionState`) updates on the next render — reading
`sessionState.startTime` immediately after calling `startRecording()` in the same
handler will see the *previous* render's value (`null` on first start). Use
`getRecordingManager().getRecordingState().startTime` instead, which reads the
manager directly:

```typescript
const handleStartRecording = () => {
  startRecording(sessionTitle);
  const startTime = getRecordingManager().getRecordingState().startTime;
  if (startTime) {
    screenShare.start(startTime);
  }
};
```

(`getRecordingManager` is already destructured from `useRecording()`'s return
value — add it to the existing destructure if not already present.)

- [ ] **Step 2: Manual verification**

Run: `pnpm exec turbo dev --filter=web`. Click "Start Recording", accept the share
picker for a browser tab, type some code, click "Stop Recording". Confirm in
DevTools → Application → IndexedDB → `tantrica_recordings` → `videos` that a blob
was saved keyed by the session id, and that its `offsetMs` is roughly the time
between clicking "Start Recording" and accepting the share picker. Repeat and
cancel the picker instead — confirm recording still saves normally with no video
entry and no console error.

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/components/editor/MonacoEditor.tsx
git commit -m "feat(web): start screen share capture alongside editor recording"
```

---

### Task 7: `ScreenShareOverlay` playback component

**Files:**
- Create: `apps/web/app/components/viewer/ScreenShareOverlay.tsx`
- Modify: `apps/web/app/components/viewer/PlaybackViewer.tsx`

**Interfaces:**
- Consumes: `storage.getVideoUrl(recordingId)` from Task 3/5,
  `RecordingSession.screenShareOffsetMs` from Task 1, `position.currentTime`/
  `playbackState` already present in `PlaybackViewer`.
- Produces: a draggable/resizable, non-interactive PiP video overlay rendered only
  when the loaded session has a video.

- [ ] **Step 1: Implement the overlay component**

Structurally mirrors `apps/web/app/components/playground/FloatingPreviewWindow.tsx`
(same drag/resize-by-edge interaction — reuse that file's `startInteraction` logic
verbatim, swapping the header label and body content):

```typescript
// apps/web/app/components/viewer/ScreenShareOverlay.tsx
'use client';

import { useEffect, useRef, useState } from 'react';

type Interaction = 'move' | 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

const MIN_W = 240;
const MIN_H = 160;
const DEFAULT_W = 340;
const DEFAULT_H = 220;
const GRAB_MARGIN = 48;

interface ScreenShareOverlayProps {
  videoUrl: string;
  offsetMs: number;
  currentTimeMs: number;
  isPlaying: boolean;
  containerRef: React.RefObject<HTMLDivElement | null>;
}

/** Non-interactive PiP screen-share video, synced to the editor playback clock. */
export default function ScreenShareOverlay({
  videoUrl,
  offsetMs,
  currentTimeMs,
  isPlaying,
  containerRef,
}: ScreenShareOverlayProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [rect, setRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [isInteracting, setIsInteracting] = useState(false);
  const interactionRef = useRef<{
    mode: Interaction;
    startX: number;
    startY: number;
    base: { x: number; y: number; w: number; h: number };
  } | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    setRect(
      (prev) =>
        prev ?? {
          x: Math.max(el.clientWidth - DEFAULT_W - 24, 16),
          y: Math.max(el.clientHeight - DEFAULT_H - 24, 16),
          w: DEFAULT_W,
          h: DEFAULT_H,
        }
    );
  }, [containerRef]);

  // Sync video position/play-state to the editor playback clock.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const targetSeconds = Math.max(0, (currentTimeMs - offsetMs) / 1000);
    if (Number.isFinite(video.duration) && Math.abs(video.currentTime - targetSeconds) > 0.3) {
      video.currentTime = Math.min(targetSeconds, video.duration || targetSeconds);
    }
    if (isPlaying && currentTimeMs >= offsetMs) {
      video.play().catch(() => {});
    } else {
      video.pause();
    }
  }, [currentTimeMs, offsetMs, isPlaying]);

  const startInteraction = (mode: Interaction) => (e: React.PointerEvent) => {
    if (!rect) return;
    e.preventDefault();
    e.stopPropagation();
    interactionRef.current = { mode, startX: e.clientX, startY: e.clientY, base: rect };
    setIsInteracting(true);

    const onMove = (ev: PointerEvent) => {
      const s = interactionRef.current;
      if (!s) return;
      const dx = ev.clientX - s.startX;
      const dy = ev.clientY - s.startY;
      let { x, y, w, h } = s.base;

      if (s.mode === 'move') {
        x += dx;
        y += dy;
        const container = containerRef.current;
        if (container) {
          x = Math.max(GRAB_MARGIN - w, Math.min(x, container.clientWidth - GRAB_MARGIN));
          y = Math.max(0, Math.min(y, container.clientHeight - GRAB_MARGIN));
        }
      } else {
        if (s.mode.includes('e')) w = Math.max(MIN_W, s.base.w + dx);
        if (s.mode.includes('s')) h = Math.max(MIN_H, s.base.h + dy);
        if (s.mode.includes('w')) {
          w = Math.max(MIN_W, s.base.w - dx);
          x = s.base.x + (s.base.w - w);
        }
        if (s.mode.includes('n')) {
          h = Math.max(MIN_H, s.base.h - dy);
          y = s.base.y + (s.base.h - h);
        }
      }
      setRect({ x, y, w, h });
    };
    const onUp = () => {
      interactionRef.current = null;
      setIsInteracting(false);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  if (currentTimeMs < offsetMs) return null; // nothing was being shared yet

  return (
    <div
      className="absolute z-30 flex flex-col rounded-lg border border-border bg-background shadow-2xl"
      style={rect ? { left: rect.x, top: rect.y, width: rect.w, height: rect.h } : undefined}
    >
      <div onPointerDown={startInteraction('n')} className="absolute -top-1 left-2 right-2 h-2 cursor-ns-resize z-10" />
      <div onPointerDown={startInteraction('s')} className="absolute -bottom-1 left-2 right-2 h-2 cursor-ns-resize z-10" />
      <div onPointerDown={startInteraction('w')} className="absolute -left-1 top-2 bottom-2 w-2 cursor-ew-resize z-10" />
      <div onPointerDown={startInteraction('e')} className="absolute -right-1 top-2 bottom-2 w-2 cursor-ew-resize z-10" />
      <div onPointerDown={startInteraction('nw')} className="absolute -top-1 -left-1 w-3.5 h-3.5 cursor-nwse-resize z-20" />
      <div onPointerDown={startInteraction('ne')} className="absolute -top-1 -right-1 w-3.5 h-3.5 cursor-nesw-resize z-20" />
      <div onPointerDown={startInteraction('sw')} className="absolute -bottom-1 -left-1 w-3.5 h-3.5 cursor-nesw-resize z-20" />
      <div onPointerDown={startInteraction('se')} className="absolute -bottom-1 -right-1 w-3.5 h-3.5 cursor-nwse-resize z-20" />

      <div
        onPointerDown={startInteraction('move')}
        className="flex items-center px-3 py-1.5 bg-sidebar border-b border-border cursor-move select-none flex-shrink-0 rounded-t-lg"
      >
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          Screen Share
        </span>
      </div>
      <div className={`flex-grow min-h-0 overflow-hidden rounded-b-lg bg-black ${isInteracting ? 'pointer-events-none' : ''}`}>
        <video ref={videoRef} src={videoUrl} muted playsInline className="w-full h-full object-contain" />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Wire into `PlaybackViewer.tsx`**

Add a `containerRef` on the editor's wrapping div (currently plain
`<div className="flex-1 relative min-w-0">` at line 560) and load the video URL
when the session has an offset:

```typescript
// apps/web/app/components/viewer/PlaybackViewer.tsx — additions
import ScreenShareOverlay from './ScreenShareOverlay';
import { getRecordingStorage } from '@/lib/storage';
import { useAuth } from '@/hooks/useAuth';

// inside the component:
const { isAuthenticated } = useAuth();
const storage = getRecordingStorage(() => isAuthenticated);
const editorContainerRef = useRef<HTMLDivElement>(null);
const [videoUrl, setVideoUrl] = useState<string | null>(null);

useEffect(() => {
  if (!session?.screenShareOffsetMs) {
    setVideoUrl(null);
    return;
  }
  let cancelled = false;
  storage.getVideoUrl?.(session.id).then((url) => {
    if (!cancelled) setVideoUrl(url);
  });
  return () => {
    cancelled = true;
  };
}, [session?.id, session?.screenShareOffsetMs, storage]);

// in the JSX, change:
//   <div className="flex-1 relative min-w-0">
// to:
//   <div className="flex-1 relative min-w-0" ref={editorContainerRef}>
// and after the Editor's closing wrapper div, before the outer </div> at line 594:
{videoUrl && session.screenShareOffsetMs !== undefined ? (
  <ScreenShareOverlay
    videoUrl={videoUrl}
    offsetMs={session.screenShareOffsetMs}
    currentTimeMs={position.currentTime}
    isPlaying={playbackState === PlaybackState.PLAYING}
    containerRef={editorContainerRef}
  />
) : null}
```

- [ ] **Step 3: Manual verification**

Run: `pnpm exec turbo dev --filter=web`. Open a recording made in Task 6 that
includes a screen share (via `/view`). Confirm: the overlay appears bottom-right
once playback reaches the offset time; it plays/pauses in sync with the editor
transport controls; scrubbing the timeline seeks the video too; dragging/resizing
the overlay works and the editor beneath remains fully interactive/scrollable.
Open a recording with no screen share and confirm no overlay renders and no
console error from a missing `getVideoUrl`.

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/components/viewer/ScreenShareOverlay.tsx apps/web/app/components/viewer/PlaybackViewer.tsx
git commit -m "feat(web): render synced screen-share PiP overlay during playback"
```

---

### Task 8: Full end-to-end verification

**Files:** none (verification only)

- [ ] **Step 1: Type-check and lint the whole workspace**

Run: `pnpm check-types && pnpm lint`
Expected: both pass with 0 errors/warnings.

- [ ] **Step 2: Build everything**

Run: `pnpm build`
Expected: succeeds, including the `openscrim-core` type change flowing through to
`apps/web`.

- [ ] **Step 3: End-to-end manual pass**

With the dev server running and `MONGODB_URI` set (authenticated flow):
1. Record a session, sharing a browser tab partway through the click (accept the
   picker).
2. Stop recording — confirm success toast, and confirm (Task 4's manual check
   pattern) the video reached GridFS by checking the Mongo `Recording` doc has
   `videoFileId` set.
3. Open the recording in `/view` — confirm the PiP overlay appears, syncs, and is
   draggable.
4. Repeat once fully offline (`NEXT_PUBLIC_LOCAL_ONLY=true`, restart dev server) —
   confirm the same flow works purely through IndexedDB with no network calls.

- [ ] **Step 4: Commit (if any fixups were needed)**

```bash
git add -A
git commit -m "fix: address issues found in end-to-end screen-share verification"
```

(Skip this commit if step 3 found nothing to fix.)
