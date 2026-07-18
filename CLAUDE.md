# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

OpenScrim records coding sessions in a Monaco editor (keystrokes, cursor moves, content changes as timestamped events) and plays them back like a video, with seek, speed control, and the ability to "fork" a playback at any point into an editable session. Pnpm (v9) + Turborepo monorepo. The project was previously named **Tantrica** — that name still appears in the `.tantrica` file format, `docs/`, and some identifiers.

Note: `AGENTS.md` is stale — it references a NestJS `apps/api` that was removed when the backend was migrated into Next.js API routes (commit `92fa465`). Trust this file and the code over `AGENTS.md`.

## Commands

```bash
pnpm install
pnpm dev                                  # all apps (turbo)
pnpm exec turbo dev --filter=web          # just the web app (port 3000)
pnpm build                                # build everything
pnpm lint                                 # eslint, --max-warnings 0
pnpm check-types                          # tsc --noEmit in every package
pnpm format                               # prettier on ts/tsx/md
pnpm exec turbo <task> --filter=<pkg>     # single package; names: web, @repo/openscrim-core, @repo/ui, @repo/types
```

There are no tests anywhere in the repo yet.

`@repo/openscrim-core` resolves via its compiled `dist/` (not source), so after editing `packages/openscrim-core/src/` run `pnpm exec turbo build --filter=@repo/openscrim-core` (or full `pnpm build`) for the web app to pick up changes. Turbo's `dependsOn: ^build` handles this ordering in full builds, but `dev` does not rebuild core.

## Architecture

### packages/openscrim-core — the domain engine (framework-agnostic, no React)

- `types.ts` — the event model everything is built on: `RecordingEvent` union (keystroke, cursor_position, selection_change, content_change, focus/blur, language_change, recording control) and `RecordingSession`.
- `RecordingManager.ts` — captures editor events into a session buffer.
- `PlaybackEngine.ts` — schedules and replays events; emits to consumers via handler callbacks (Observer pattern).
- `compression.ts` — `compressEvents`/`decompressEvents` (delta encoding, cursor dedup).
- `format.ts` — the `.tantrica` file format: JSON + gzip with magic bytes; `sessionToTantricaFile`, `readTantricaBuffer`, etc.

### apps/web — Next.js 15 (App Router, React 19, Tailwind v4), frontend AND backend

Path alias `@/*` → `apps/web/app/*`. Route groups:

- `(main)` — landing, `/dashboard` (recording library), `/upload` (.tantrica upload)
- `(studio)` — `/record` (recording studio) and `/view` (playback + fork UI)
- `/r/[id]` — public share/player page
- `api/` — the backend (migrated from a former NestJS app):
  - `api/auth/[...nextauth]` — NextAuth v5 (beta) with Google provider. `lib/auth.ts` upserts users into MongoDB on sign-in and copies Mongo `_id` + profile fields into the JWT/session. Session augmentation types live in `app/types/next-auth.d.ts`.
  - `api/recordings/...` — CRUD, `upload`, `[id]/download`, `[id]/events` (paginated) + `events/all`, `[id]/play`, `public`. Routes follow a consistent pattern: `auth()` guard → `connectToDatabase()` → call functions from `lib/recordingsService.ts` → JSON envelope `{ status, code, message, data }`.

### Persistence — two layers, don't confuse them

- **Server (MongoDB via Mongoose)**: `lib/mongodb.ts` (cached connection, needs `MONGODB_URI`), models in `lib/models/`: `User`, `Recording` (metadata), `RecordingEventBatch` (events chunked into batches keyed by `recordingId` + `sequenceIndex`).
- **Client (IndexedDB)**: `lib/storage/` implements the `RecordingStorage` interface with three adapters — `IndexedDBStorageAdapter` (local), `ApiStorageAdapter` (HTTP), and `SmartStorageAdapter`, which the app uses: always saves locally, mirrors to the API when authenticated, and falls back local↔API on reads. Anonymous users get fully local recording.
- **Forks** (`lib/forkStorage.ts`, `lib/forkTypes.ts`) are IndexedDB-only: a `Fork` snapshots content/language/cursor at a playback timestamp and is auto-saved as the user edits.

### Client state

`context/AuthProvider.tsx` + `hooks/useAuth.ts` wrap the NextAuth session; `hooks/useRecordings.ts` is the main hook orchestrating RecordingManager/storage; `components/viewer/PlaybackViewer.tsx` and `components/editor/MonacoEditor.tsx` are the two big components driving playback and capture.

## Environment

No `.env.example` exists. Required for a working app: `MONGODB_URI`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `AUTH_SECRET`. Optional `NEXT_PUBLIC_*` flags (max recording duration, autosave, debug) are centralized in `app/config/env.ts` — read client env through that module, not `process.env` directly.
