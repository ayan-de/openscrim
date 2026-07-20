export { ScrimRecorder } from './ScrimRecorder.js';
export type { ScrimRecorderProps } from './ScrimRecorder.js';

export { ScrimPlayer } from './ScrimPlayer.js';
export type { ScrimPlayerProps } from './ScrimPlayer.js';

export { useRecorder } from './useRecorder.js';
export type {
  UseRecorderOptions,
  UseRecorderResult,
  EditorMountHandler,
} from './useRecorder.js';

export { usePlayer } from './usePlayer.js';
export type { UsePlayerOptions, UsePlayerResult } from './usePlayer.js';

// Re-exported for convenience so consumers can type their persistence layer
// without a second dependency on the core package.
export type {
  RecordingSession,
  RecordingSessionState,
  MousePointerEvent,
  FileChangeEvent,
  PlaybackPosition,
  TantricaFile,
} from '@thisisayande/openscrim-core';
export { PlaybackState, RecordingState } from '@thisisayande/openscrim-core';
