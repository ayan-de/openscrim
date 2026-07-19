export interface Position {
  lineNumber: number;
  column: number;
}

export interface Range {
  startLineNumber: number;
  startColumn: number;
  endLineNumber: number;
  endColumn: number;
}

export interface Selection {
  selectionStartLineNumber: number;
  selectionStartColumn: number;
  positionLineNumber: number;
  positionColumn: number;
}

export enum RecordingEventType {
  KEYSTROKE = 'keystroke',
  CURSOR_POSITION = 'cursor_position',
  SELECTION_CHANGE = 'selection_change',
  CONTENT_CHANGE = 'content_change',
  FILE_CHANGE = 'file_change',
  EDITOR_FOCUS = 'editor_focus',
  EDITOR_BLUR = 'editor_blur',
  LANGUAGE_CHANGE = 'language_change',
  RECORDING_START = 'recording_start',
  RECORDING_PAUSE = 'recording_pause',
  RECORDING_RESUME = 'recording_resume',
  RECORDING_STOP = 'recording_stop',
}

export interface BaseRecordingEvent {
  id: string;
  type: RecordingEventType;
  timestamp: number;
  sessionId: string;
}

export interface KeystrokeEvent extends BaseRecordingEvent {
  type: RecordingEventType.KEYSTROKE;
  key: string;
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  position: Position;
}

export interface CursorPositionEvent extends BaseRecordingEvent {
  type: RecordingEventType.CURSOR_POSITION;
  position: Position;
  previousPosition?: Position;
}

export interface SelectionChangeEvent extends BaseRecordingEvent {
  type: RecordingEventType.SELECTION_CHANGE;
  selection: Selection;
  previousSelection?: Selection;
}

export interface ContentChangeEvent extends BaseRecordingEvent {
  type: RecordingEventType.CONTENT_CHANGE;
  changes: Array<{
    range: Range;
    rangeLength: number;
    text: string;
  }>;
  versionId: number;
  eol: string;
  isFlush: boolean;
  isRedoing: boolean;
  isUndoing: boolean;
}

/**
 * The editor switched to a different file (e.g. the host swapped the model).
 * `content` snapshots the file as it was at switch time so playback can
 * restore it without replaying the whole session.
 */
export interface FileChangeEvent extends BaseRecordingEvent {
  type: RecordingEventType.FILE_CHANGE;
  /** Path of the file now active in the editor */
  path: string;
  previousPath?: string;
  content?: string;
  language?: string;
}

export interface EditorFocusEvent extends BaseRecordingEvent {
  type: RecordingEventType.EDITOR_FOCUS;
}

export interface EditorBlurEvent extends BaseRecordingEvent {
  type: RecordingEventType.EDITOR_BLUR;
}

export interface LanguageChangeEvent extends BaseRecordingEvent {
  type: RecordingEventType.LANGUAGE_CHANGE;
  language: string;
  previousLanguage?: string;
}

export interface RecordingControlEvent extends BaseRecordingEvent {
  type:
    | RecordingEventType.RECORDING_START
    | RecordingEventType.RECORDING_PAUSE
    | RecordingEventType.RECORDING_RESUME
    | RecordingEventType.RECORDING_STOP;
}

export type RecordingEvent =
  | KeystrokeEvent
  | CursorPositionEvent
  | SelectionChangeEvent
  | ContentChangeEvent
  | FileChangeEvent
  | EditorFocusEvent
  | EditorBlurEvent
  | LanguageChangeEvent
  | RecordingControlEvent;

export interface RecordingSession {
  id: string;
  title: string;
  description?: string;
  language: string;
  initialContent: string;
  finalContent: string;
  duration: number;
  events: RecordingEvent[];
  /**
   * Snapshot of the whole project (path → content) at recording start, so
   * playback can show files the recording never opened.
   */
  files?: Record<string, string>;
  createdAt: Date;
  updatedAt: Date;
  metadata?: {
    editorTheme?: string;
    fontSize?: number;
    tabSize?: number;
    [key: string]: string | number | boolean | undefined;
  };
}

export enum RecordingState {
  IDLE = 'idle',
  RECORDING = 'recording',
  PAUSED = 'paused',
  STOPPED = 'stopped',
}

export interface RecordingSessionState {
  sessionId: string | null;
  sessionTitle?: string;
  state: RecordingState;
  startTime: number | null;
  pausedTime: number;
  currentDuration: number;
  eventCount: number;
  lastEventTimestamp: number | null;
}

export interface RecordingConfig {
  captureKeystrokes: boolean;
  captureCursorMovement: boolean;
  captureSelections: boolean;
  captureContentChanges: boolean;
  captureFileChanges: boolean;
  captureEditorEvents: boolean;
  debounceDelay: number;
  compressionEnabled: boolean;
  maxEventBufferSize: number;
}

export const DEFAULT_RECORDING_CONFIG: RecordingConfig = {
  captureKeystrokes: true,
  captureCursorMovement: true,
  captureSelections: true,
  captureContentChanges: true,
  captureFileChanges: true,
  captureEditorEvents: true,
  debounceDelay: 50,
  compressionEnabled: true,
  maxEventBufferSize: 10000,
};
