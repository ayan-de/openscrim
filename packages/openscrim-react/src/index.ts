export { ScrimRecorder } from './ScrimRecorder.js';
export type { ScrimRecorderProps } from './ScrimRecorder.js';

export { ScrimPlayer } from './ScrimPlayer.js';
export type {
  ScrimPlayerProps,
  PlayerFiles,
  ScrimForkMarker,
  ScrimForkDraft,
  ScrimForkEdits,
  ScrimForkContent,
} from './ScrimPlayer.js';

export { FileTree } from './FileTree.js';
export type { FileTreeProps } from './FileTree.js';
export { buildFileTree, languageForPath } from './file-tree.js';
export type { TreeNode } from './file-tree.js';

export { resolveTheme, injectStyles, OPENSCRIM_CSS } from './styles.js';
export type { OpenScrimTheme, ThemeInput } from './styles.js';

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
