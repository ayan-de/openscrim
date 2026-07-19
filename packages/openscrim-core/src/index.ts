export type {
  Position,
  Range,
  Selection,
  BaseRecordingEvent,
  KeystrokeEvent,
  CursorPositionEvent,
  SelectionChangeEvent,
  ContentChangeEvent,
  FileChangeEvent,
  ScrollEvent,
  EditorFocusEvent,
  EditorBlurEvent,
  LanguageChangeEvent,
  RecordingControlEvent,
  RecordingEvent,
  RecordingSession,
  RecordingSessionState,
  RecordingConfig,
} from './types.js';

export {
  RecordingEventType,
  RecordingState,
  DEFAULT_RECORDING_CONFIG,
} from './types.js';

export { RecordingManager } from './RecordingManager.js';

export { PlaybackEngine, PlaybackState } from './PlaybackEngine.js';

export type {
  PlaybackPosition,
  PlaybackOptions,
  PlaybackEventHandler,
  SchedulerOptions,
} from './PlaybackEngine.js';

export { compressEvents, decompressEvents } from './compression.js';

export type { TantricaFile } from './format.js';

export {
  sessionToTantricaFile,
  tantricaFileToSession,
  writeTantricaBuffer,
  readTantricaBuffer,
} from './format.js';
