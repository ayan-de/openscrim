# Tantrica — Coding Agent Rules

## Project Identity

Tantrica is a **DOM-based code recording and playback platform**. It captures editor DOM events (keystrokes, cursor, selections, content changes) instead of pixel-based screen recordings. Result: ~1-3MB per hour of coding (gzipped), zero quality loss, seekable to any millisecond.

**Target users**: Teachers recording coding tutorials, Developers recording code walkthroughs/bug repros/PR explanations.

---

## Monorepo Structure

```
apps/
  web/          → Next.js 15 frontend (React 19, Tailwind v4, Monaco Editor, App Router)
  api/          → NestJS 10 backend (Google OAuth, Express session, MongoDB/Mongoose)
  vscode/       → VS Code extension (Phase 2, not yet built)
packages/
  ui/           → Shared React component library (@repo/ui)
  openscrim-core/→ Shared recording engine (types, RecordingManager, PlaybackEngine, compression, .tantrica format)
  eslint-config/→ Shared ESLint flat configs
  typescript-config/ → Shared tsconfig bases
```

**Package manager**: pnpm v9. Node >= 18. TypeScript 5.9. Turborepo for builds.

---

## Commands

| Task           | Command                                          |
| -------------- | ------------------------------------------------ |
| Install        | `pnpm install`                                   |
| Dev (all)      | `pnpm dev`                                       |
| Dev (web only) | `pnpm exec turbo dev --filter=web`               |
| Dev (api only) | `pnpm exec turbo dev --filter=@repo/api`         |
| Build (all)    | `pnpm build`                                     |
| Lint (all)     | `pnpm lint`                                      |
| Type-check     | `pnpm check-types`                               |
| Format         | `pnpm format`                                    |
| Test (API)     | `pnpm exec turbo test --filter=@repo/api`        |
| Test single    | `cd apps/api && pnpm exec jest src/path.spec.ts` |

**ALWAYS run `pnpm lint` and `pnpm check-types` after making changes. Fix all errors before done.**

---

## Architecture Rules

### Core Engine (`packages/openscrim-core`)

- **Strategy Pattern** for event capture: `MonacoEventCapture` (web) vs `VSCodeEventCapture` (extension). `RecordingManager` is agnostic to event source.
- **Observer Pattern** for playback: `PlaybackEngine` emits events, UI components subscribe.
- **Adapter Pattern** for storage: `RecordingStorage` interface with `LocalStorageAdapter` (offline/demo) and `ApiStorageAdapter` (production).
- **Repository Pattern** on backend: Services never touch MongoDB directly — go through repositories.
- **Factory Pattern** for .tantrica files: `TantricaFileReader.fromBuffer()` handles version detection.

### .tantrica File Format

Binary format: `TNTC` magic bytes (4B) + version uint16 (2B) + header length uint32 (4B) + JSON header + gzipped event stream. Version field is 1. Always maintain backward compatibility.

### Event Compression

Use delta encoding for positions, deduplicate cursor events within 50ms, batch keystrokes within 16ms frames, keep only latest content change per 50ms window, omit fields matching defaults.

### Database (MongoDB)

- `users` — email, name, picture, provider info
- `recordings` — metadata (title, language, duration, eventCount, fileSize, editorConfig, tags, isPublic, playCount)
- `recording_events` — batched (~100 events per document), indexed by recordingId + sequenceIndex. Kept separate because 1hr recording = 50K+ events.

### API Endpoints

- Auth: `/auth/google`, `/auth/google/callback`, `/auth/profile`, `/auth/logout`
- Recordings CRUD: `POST/GET/PATCH/DELETE /recordings`
- Events: `GET /recordings/:id/events` (paginated), `GET /recordings/:id/events/all`
- File: `POST /recordings/upload`, `GET /recordings/:id/download`

### Web Routes

- `/` — Homepage with playground cards
- `/record` — In-browser recording studio
- `/view` — Browse recordings (loads from API)
- `/r/:id` — Public recording player (core product page)
- `/dashboard` — User's recording library
- `/upload` — Upload .tantrica files
- `/auth/callback` — OAuth callback

---

## Code Style

### Formatting (Prettier)

Single quotes. Semicolons always. Trailing commas: ES5. Print width: 80. Tab width: 2 spaces.

### TypeScript

- Web app: `strict: true`, `noUncheckedIndexedAccess: true`
- API: less strict (`strictNullChecks: false`, `noImplicitAny: false`), uses `experimentalDecorators`
- Shared packages: strict mode, no `any`
- Use `import type` for type-only imports: `import type { Foo } from 'bar'`

### Imports

- Web app: `@/*` maps to `./app/*` (e.g., `import { env } from '@/config/env'`)
- Shared: `@repo/ui`, `@repo/openscrim-core`, `@repo/eslint-config/*`, `@repo/typescript-config/*`
- API: relative imports (NestJS convention)
- Group: framework/external first, then internal packages, then local aliases. Blank line between groups.

### React / Next.js

- App Router with route groups: `(main)`, `(studio)`, `auth`
- Client components must start with `'use client'`
- Pages use default exports: `export default function PageName()`
- Shared UI components use named exports: `export const Button = ...`
- Use `interface` for component props (not `type`)
- Hooks: `use*` naming. Context providers: `*Provider` naming.
- Use `cn()` from `@/lib/utils` for conditional Tailwind class merging.

### NestJS API

- Module structure: `*.module.ts`, `*.controller.ts`, `*.service.ts`
- Use `ConfigService` for env vars, never `process.env` directly
- API runs on port 5000

### Naming

- Files: PascalCase for components, camelCase for utilities/hooks
- Directories: camelCase or kebab-case
- Classes: PascalCase. Interfaces: PascalCase without `I` prefix.
- Constants: UPPER_SNAKE_CASE. Functions: camelCase.

### Error Handling

- Throw `Error` objects with descriptive messages
- `catch (error: any)` then `error.message`
- In React contexts/hooks: catch and `console.error`, don't propagate to UI

### General

- No comments unless requested
- Use `pnpm format` before committing
- Never commit secrets or `.env` files

---

## Key Libraries

- **Monaco Editor** (`@monaco-editor/react`) — in-browser code editor
- **Radix UI** — headless UI primitives
- **Lucide React** — icons
- **ogl** — lightweight WebGL library (Aurora background)
- **Mongoose** — MongoDB ODM
- **class-variance-authority** + **clsx** + **tailwind-merge** — component styling

---

## Phase Plan (Current: Phase 1)

| Phase | Status      | Focus                                       |
| ----- | ----------- | ------------------------------------------- |
| 1.1   | Done        | Bug fixes                                   |
| 1.2   | Done        | MongoDB backend, recording CRUD API         |
| 1.3   | In Progress | `packages/openscrim-core` shared package    |
| 1.4   | Pending     | New web pages (/r/:id, /dashboard, /upload) |
| 1.5   | Pending     | Storage adapter pattern                     |
| 2     | Blocked     | VS Code extension (needs openscrim-core)    |
| 3     | Blocked     | Interactive playback, fork, annotations     |

### Completed Fixes (P0/P1/P2 from Architecture Review)

All P0, P1, and P2 items from `ARCHITECTURE_RECOMMENDATIONS.md` are done, including: buffer duplication, PlaygroundModal wiring, OAuth security, session secret, API client consolidation, PlaybackEngine RAF, snapshot-based seeking, IndexedDB storage, typed sessions, strictNullChecks in API, ConfigService usage, shared `@repo/types`, language detection, import type usage.

### Remaining Tech Debt (P3)

- Populate `@repo/ui` with shared components or remove
- Add list virtualization to recordings view
- Add error boundaries around Monaco and Playback
- Fix Aurora.tsx useEffect dependency for amplitude changes
- Replace localStorage polling with shared context or custom events
- Add server-side recording persistence
- Add CSRF protection and rate limiting
- Clean up dead CSS and old files

---

## Performance Targets

| Metric                     | Target        |
| -------------------------- | ------------- |
| 1hr recording file size    | < 3MB gzipped |
| Playback start time        | < 2 seconds   |
| Seek to any point          | < 500ms       |
| Recording capture overhead | < 5% CPU      |
| Mobile playback            | Works on 3G   |

---

## What NOT To Do

- Don't add pixel-based video recording — Tantrica is DOM-only
- Don't store recordings in localStorage in production — use API
- Don't use `any` in shared packages
- Don't skip running lint/typecheck after changes
- Don't hardcode `language: 'javascript'` — detect from editor
- Don't use `process.env` directly in API — use `ConfigService`
- Don't use `alert()` in UI — use `LoadingContext.showSuccess/showError`
- Don't add comments unless requested
- Don't create files outside the monorepo structure
