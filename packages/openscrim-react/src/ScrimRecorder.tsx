import { type CSSProperties, type ReactNode, useEffect } from 'react';
import { Editor } from '@monaco-editor/react';
import type * as monacoType from 'monaco-editor';
import { useRecorder, type UseRecorderResult } from './useRecorder.js';
import { injectStyles, resolveTheme, type ThemeInput } from './styles.js';
import type { RecordingConfig, RecordingSession } from '@thisisayande/openscrim-core';

function formatTime(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export interface ScrimRecorderProps {
  language?: string;
  /** Starting editor content. Recording is capture-based, so this is uncontrolled. */
  defaultValue?: string;
  /** Title stamped onto the session when recording starts. */
  title?: string;
  /** 'dark' | 'light' | a partial token override object. */
  theme?: ThemeInput;
  /** Override the Monaco theme id (defaults from `theme`'s base). */
  monacoTheme?: string;
  height?: string | number;
  editorOptions?: monacoType.editor.IStandaloneEditorConstructionOptions;
  config?: Partial<RecordingConfig>;
  /** Delivered the finished session on stop. Persist it however you like. */
  onComplete?: (session: RecordingSession) => void;
  onError?: (error: Error) => void;
  controls?: boolean;
  /** Full-control escape hatch: replace the default UI (editor still renders above). */
  children?: (recorder: UseRecorderResult) => ReactNode;
  className?: string;
  style?: CSSProperties;
}

/**
 * Batteries-included, themeable recording surface: a Monaco editor plus a
 * control bar. Records keystrokes/cursor/selection/content into an OpenScrim
 * session and hands it back through `onComplete`. No storage, auth, or network.
 */
export function ScrimRecorder({
  language = 'javascript',
  defaultValue = '',
  title = 'Untitled Session',
  theme,
  monacoTheme,
  height = '480px',
  editorOptions,
  config,
  onComplete,
  onError,
  controls = true,
  children,
  className,
  style,
}: ScrimRecorderProps) {
  useEffect(() => {
    if (typeof document !== 'undefined') injectStyles(document);
  }, []);
  const resolved = resolveTheme(theme);

  const recorder = useRecorder({ config, onComplete, onError });
  const { isRecording, isPaused, duration, eventCount, start, pause, resume, stop } =
    recorder;
  const active = isRecording || isPaused;

  return (
    <div
      className={`openscrim ${className ?? ''}`}
      data-theme={resolved.base}
      style={{ ...resolved.vars, ...style } as CSSProperties}
    >
      {controls && !children && (
        <div className="os-controls" style={{ borderTop: 'none', borderBottom: '1px solid var(--os-border)' }}>
          <button
            type="button"
            className={active ? 'os-btn' : 'os-btn os-btn-primary'}
            onClick={() => (active ? stop() : start(title))}
          >
            {active ? '■ Stop' : '● Record'}
          </button>
          <button
            type="button"
            className="os-btn"
            onClick={() => (isPaused ? resume() : pause())}
            disabled={!active}
          >
            {isPaused ? 'Resume' : 'Pause'}
          </button>
          <span className="os-time">
            {isRecording ? '● ' : ''}
            {formatTime(duration)}
          </span>
          <span className="os-hint" style={{ marginLeft: 'auto' }}>
            {eventCount.toLocaleString()} events
          </span>
        </div>
      )}

      {/* flex:'none' so the inline height wins over .os-editor's flex-grow */}
      <div className="os-editor" style={{ height, flex: 'none' }}>
        <Editor
          height="100%"
          defaultLanguage={language}
          defaultValue={defaultValue}
          theme={monacoTheme ?? resolved.monaco}
          onMount={(editor, monaco) =>
            recorder.onMount(editor, monaco as unknown as typeof monacoType)
          }
          options={{
            minimap: { enabled: false },
            automaticLayout: true,
            scrollBeyondLastLine: false,
            ...editorOptions,
          }}
        />
      </div>

      {children?.(recorder)}
    </div>
  );
}
