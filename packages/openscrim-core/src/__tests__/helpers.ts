import type {
  ContentChangeEvent,
  CursorPositionEvent,
  KeystrokeEvent,
  MousePointerEvent,
  RecordingEvent,
  RecordingSession,
  ScrollEvent,
} from '../types.js';
import { RecordingEventType } from '../types.js';

let nextId = 0;

function base(timestamp: number) {
  return {
    id: `evt-${nextId++}`,
    timestamp,
    sessionId: 'session-1',
  };
}

export function keystroke(timestamp: number, key = 'a'): KeystrokeEvent {
  return {
    ...base(timestamp),
    type: RecordingEventType.KEYSTROKE,
    key,
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    position: { lineNumber: 1, column: 1 },
  };
}

export function cursor(timestamp: number, column = 1): CursorPositionEvent {
  return {
    ...base(timestamp),
    type: RecordingEventType.CURSOR_POSITION,
    position: { lineNumber: 1, column },
  };
}

export function contentChange(
  timestamp: number,
  text: string
): ContentChangeEvent {
  return {
    ...base(timestamp),
    type: RecordingEventType.CONTENT_CHANGE,
    changes: [
      {
        range: {
          startLineNumber: 1,
          startColumn: 1,
          endLineNumber: 1,
          endColumn: 1,
        },
        rangeLength: 0,
        text,
      },
    ],
    versionId: timestamp,
    eol: '\n',
    isFlush: false,
    isRedoing: false,
    isUndoing: false,
  };
}

export function scroll(timestamp: number, scrollTop = 0): ScrollEvent {
  return {
    ...base(timestamp),
    type: RecordingEventType.SCROLL,
    scrollTop,
    scrollLeft: 0,
  };
}

export function pointer(
  timestamp: number,
  kind: 'move' | 'click' = 'move'
): MousePointerEvent {
  return {
    ...base(timestamp),
    type: RecordingEventType.POINTER,
    kind,
    x: 0.5,
    y: 0.5,
  };
}

export function makeSession(
  overrides: Partial<RecordingSession> = {}
): RecordingSession {
  const events: RecordingEvent[] = [
    keystroke(0, 'c'),
    contentChange(1, 'c'),
    cursor(2, 2),
    scroll(3, 10),
    pointer(4),
  ];
  return {
    id: 'session-1',
    title: 'Test session',
    description: 'A test recording',
    language: 'typescript',
    initialContent: 'const a = 1;\n',
    finalContent: 'const a = 1;\nconst b = 2;\n',
    duration: 5000,
    events,
    files: { 'index.ts': 'const a = 1;\n' },
    createdAt: new Date('2026-01-02T03:04:05.678Z'),
    updatedAt: new Date('2026-01-02T03:04:05.678Z'),
    metadata: { editorTheme: 'vs-dark', fontSize: 14, tabSize: 2 },
    ...overrides,
  };
}
