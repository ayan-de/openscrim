import type * as monacoType from 'monaco-editor';
import type {
  ContentChangeEvent,
  CursorPositionEvent,
  FileChangeEvent,
  LanguageChangeEvent,
  PlaybackEngine,
  PlaybackEventHandler,
  ScrollEvent,
  SelectionChangeEvent,
} from '@thisisayande/openscrim-core';

/** Shape of the `data` payload PlaybackEngine emits with `eventProcessed`. */
export type PlaybackRenderData =
  | { type: 'reset'; content: string; language?: string }
  | { type: 'contentChange'; event: ContentChangeEvent }
  | { type: 'fileChange'; event: FileChangeEvent }
  | { type: 'scroll'; event: ScrollEvent }
  | { type: 'cursorPosition'; event: CursorPositionEvent }
  | { type: 'selectionChange'; event: SelectionChangeEvent }
  | { type: 'languageChange'; event: LanguageChangeEvent };

export interface AttachPlaybackOptions {
  /**
   * Called whenever the editor's content is replaced or edited by playback.
   * Hosts that mirror editor content into their own state (e.g. a React
   * `value` prop) should sync it here to avoid clobbering applied edits.
   */
  onContentRendered?: (content: string) => void;
}

export interface PlaybackAttachment {
  detach(): void;
}

/**
 * Applies a single playback render event to a Monaco editor.
 * Exported for hosts that need custom wiring; most should use attachPlayback.
 */
export function applyPlaybackEvent(
  editor: monacoType.editor.IStandaloneCodeEditor,
  monaco: typeof monacoType,
  data: PlaybackRenderData,
  onContentRendered?: (content: string) => void
): void {
  const model = editor.getModel();
  if (!model) return;

  switch (data.type) {
    case 'reset': {
      model.setValue(data.content);
      if (data.language) {
        monaco.editor.setModelLanguage(model, data.language);
      }
      onContentRendered?.(data.content);
      break;
    }

    case 'contentChange': {
      if (!data.event.changes) break;
      const edits = data.event.changes.map((change) => ({
        range: new monaco.Range(
          change.range.startLineNumber,
          change.range.startColumn,
          change.range.endLineNumber,
          change.range.endColumn
        ),
        text: change.text,
      }));
      model.applyEdits(edits);
      onContentRendered?.(model.getValue());
      break;
    }

    case 'fileChange': {
      // Single-editor rendering: show the newly active file's snapshot.
      // Multi-file hosts can intercept these events for per-file models.
      if (data.event.content !== undefined) {
        model.setValue(data.event.content);
        onContentRendered?.(data.event.content);
      }
      if (data.event.language) {
        monaco.editor.setModelLanguage(model, data.event.language);
      }
      break;
    }

    case 'scroll': {
      editor.setScrollPosition({
        scrollTop: data.event.scrollTop,
        scrollLeft: data.event.scrollLeft,
      });
      break;
    }

    case 'cursorPosition': {
      if (data.event.position) {
        editor.setPosition({
          lineNumber: data.event.position.lineNumber,
          column: data.event.position.column,
        });
      }
      break;
    }

    case 'selectionChange': {
      if (data.event.selection) {
        editor.setSelection({
          startLineNumber: data.event.selection.selectionStartLineNumber,
          startColumn: data.event.selection.selectionStartColumn,
          endLineNumber: data.event.selection.positionLineNumber,
          endColumn: data.event.selection.positionColumn,
        });
      }
      break;
    }

    case 'languageChange': {
      if (data.event.language) {
        monaco.editor.setModelLanguage(model, data.event.language);
      }
      break;
    }
  }
}

/**
 * Subscribes a Monaco editor to a PlaybackEngine so processed events are
 * rendered into it. State/position/error events are left to the host —
 * this only handles the editor surface.
 */
export function attachPlayback(
  editor: monacoType.editor.IStandaloneCodeEditor,
  monaco: typeof monacoType,
  engine: PlaybackEngine,
  options: AttachPlaybackOptions = {}
): PlaybackAttachment {
  const handler: PlaybackEventHandler = ({ type, data }) => {
    if (type !== 'eventProcessed') return;
    applyPlaybackEvent(
      editor,
      monaco,
      data as PlaybackRenderData,
      options.onContentRendered
    );
  };

  engine.addEventHandler(handler);

  return {
    detach() {
      engine.removeEventHandler(handler);
    },
  };
}
