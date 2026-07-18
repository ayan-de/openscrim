import type * as monacoType from 'monaco-editor';
import { RecordingManager } from '@repo/openscrim-core';
import type {
  Position,
  Range,
  RecordingConfig,
  RecordingSession,
  RecordingSessionState,
  Selection,
} from '@repo/openscrim-core';

export interface MonacoRecorderOptions {
  /** Bring your own manager (e.g. to share one across editors). A new one is created otherwise. */
  manager?: RecordingManager;
  config?: Partial<RecordingConfig>;
}

/**
 * Binds a Monaco editor instance to a RecordingManager.
 *
 * Framework-agnostic: works with any host that exposes the raw
 * `IStandaloneCodeEditor` + `monaco` namespace (@monaco-editor/react's
 * onMount, a manual monaco.editor.create(), VS Code webviews, etc.).
 *
 * Lifecycle: construct once per editor, `start()`/`stop()` per session,
 * `dispose()` when the editor unmounts.
 */
export class MonacoRecorder {
  private readonly editor: monacoType.editor.IStandaloneCodeEditor;
  private readonly manager: RecordingManager;

  private sessionDisposables: monacoType.IDisposable[] = [];
  private persistentDisposables: monacoType.IDisposable[] = [];
  private initialContent = '';
  private sessionTitle = 'Untitled Session';

  constructor(
    editor: monacoType.editor.IStandaloneCodeEditor,
    monaco: typeof monacoType,
    options: MonacoRecorderOptions = {}
  ) {
    this.editor = editor;
    this.manager = options.manager ?? new RecordingManager(options.config);

    const model = editor.getModel();
    if (model) {
      this.manager.setLanguage(model.getLanguageId());
    }

    this.persistentDisposables.push(
      monaco.editor.onDidChangeModelLanguage((e) => {
        const currentModel = this.editor.getModel();
        if (currentModel && currentModel.uri === e.model.uri) {
          this.manager.setLanguage(e.model.getLanguageId());
        }
      })
    );
  }

  /** Starts a session and attaches capture listeners. Returns the session id. */
  start(title: string = 'Untitled Session'): string {
    this.sessionTitle = title;
    this.initialContent = this.editor.getValue() ?? '';
    const sessionId = this.manager.startRecording(title);
    this.attachSessionListeners();
    return sessionId;
  }

  pause(): void {
    this.manager.pauseRecording();
  }

  resume(): void {
    this.manager.resumeRecording();
  }

  /** Stops the session, detaches capture listeners, and returns the finished recording. */
  stop(title?: string, description?: string): RecordingSession | null {
    const session = this.manager.stopRecording(
      title ?? this.sessionTitle,
      description ?? 'Recorded coding session',
      this.editor.getValue() ?? '',
      this.initialContent
    );
    this.detachSessionListeners();
    return session;
  }

  getManager(): RecordingManager {
    return this.manager;
  }

  isRecording(): boolean {
    return this.manager.isRecording();
  }

  isPaused(): boolean {
    return this.manager.isPaused();
  }

  getCurrentDuration(): number {
    return this.manager.getCurrentDuration();
  }

  getEventCount(): number {
    return this.manager.getEventCount();
  }

  getRecordingState(): RecordingSessionState {
    return this.manager.getRecordingState();
  }

  dispose(): void {
    this.detachSessionListeners();
    this.persistentDisposables.forEach((d) => d?.dispose?.());
    this.persistentDisposables = [];
  }

  private attachSessionListeners(): void {
    this.detachSessionListeners();
    const { editor, manager } = this;

    this.sessionDisposables.push(
      editor.onDidChangeModelContent(
        (e: monacoType.editor.IModelContentChangedEvent) => {
          if (!manager.isRecording()) return;

          const changes = e.changes.map((change) => ({
            range: {
              startLineNumber: change.range.startLineNumber,
              startColumn: change.range.startColumn,
              endLineNumber: change.range.endLineNumber,
              endColumn: change.range.endColumn,
            } as Range,
            rangeLength: change.rangeLength,
            text: change.text,
          }));

          manager.recordContentChange(
            changes,
            e.versionId,
            e.eol,
            e.isFlush,
            e.isRedoing,
            e.isUndoing
          );
        }
      ),

      editor.onDidChangeCursorPosition(
        (e: monacoType.editor.ICursorPositionChangedEvent) => {
          if (!manager.isRecording()) return;

          const position: Position = {
            lineNumber: e.position.lineNumber,
            column: e.position.column,
          };
          manager.recordCursorPosition(position);
        }
      ),

      editor.onDidChangeCursorSelection(
        (e: monacoType.editor.ICursorSelectionChangedEvent) => {
          if (!manager.isRecording()) return;

          const selection: Selection = {
            selectionStartLineNumber: e.selection.selectionStartLineNumber,
            selectionStartColumn: e.selection.selectionStartColumn,
            positionLineNumber: e.selection.positionLineNumber,
            positionColumn: e.selection.positionColumn,
          };
          manager.recordSelectionChange(selection);
        }
      ),

      editor.onKeyDown((e: monacoType.IKeyboardEvent) => {
        if (!manager.isRecording()) return;

        const position = editor.getPosition();
        if (!position) return;

        manager.recordKeystroke(
          e.code || 'Unknown',
          { lineNumber: position.lineNumber, column: position.column },
          {
            altKey: e.altKey,
            ctrlKey: e.ctrlKey,
            metaKey: e.metaKey,
            shiftKey: e.shiftKey,
          }
        );
      })
    );
  }

  private detachSessionListeners(): void {
    this.sessionDisposables.forEach((d) => d?.dispose?.());
    this.sessionDisposables = [];
  }
}
