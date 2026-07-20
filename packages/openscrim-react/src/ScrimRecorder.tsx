import { type CSSProperties, type ReactNode } from 'react';
import { Editor } from '@monaco-editor/react';
import type * as monacoType from 'monaco-editor';
import { useRecorder, type UseRecorderResult } from './useRecorder.js';
import type { RecordingConfig, RecordingSession } from '@thisisayande/openscrim-core';

function formatTime(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export interface ScrimRecorderProps {
  /** Monaco language id for the initial file. */
  language?: string;
  /** Starting editor content. Recording is capture-based, so this is uncontrolled. */
  defaultValue?: string;
  /** Title stamped onto the session when recording starts. */
  title?: string;
  /** Monaco theme id (e.g. 'vs-dark', 'vs', 'hc-black'). */
  theme?: string;
  height?: string | number;
  /** Extra Monaco construction options, merged over the defaults. */
  editorOptions?: monacoType.editor.IStandaloneEditorConstructionOptions;
  config?: Partial<RecordingConfig>;
  /** Delivered the finished session on stop. Persist it however you like. */
  onComplete?: (session: RecordingSession) => void;
  onError?: (error: Error) => void;
  /** Render the built-in control bar. Default true. */
  controls?: boolean;
  /**
   * Full-control escape hatch: replace the default UI entirely. Receives the
   * live recorder API (and still renders the editor above your node).
   */
  children?: (recorder: UseRecorderResult) => ReactNode;
  className?: string;
  style?: CSSProperties;
}

const barStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: '8px 12px',
  fontFamily: 'system-ui, sans-serif',
  fontSize: 13,
  background: '#1e1e1e',
  color: '#ddd',
  borderBottom: '1px solid #333',
};

const btnStyle: CSSProperties = {
  cursor: 'pointer',
  border: 'none',
  borderRadius: 4,
  padding: '4px 12px',
  fontSize: 12,
  fontWeight: 600,
  color: '#fff',
};

/**
 * Batteries-included recording surface: a Monaco editor plus a control bar.
 * Records keystrokes/cursor/selection/content into an OpenScrim session and
 * hands it back through `onComplete`. No storage, auth, or network involved.
 */
export function ScrimRecorder({
  language = 'javascript',
  defaultValue = '',
  title = 'Untitled Session',
  theme = 'vs-dark',
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
  const recorder = useRecorder({ config, onComplete, onError });
  const { isRecording, isPaused, duration, eventCount, start, pause, resume, stop } =
    recorder;
  const active = isRecording || isPaused;

  return (
    <div className={className} style={{ display: 'flex', flexDirection: 'column', ...style }}>
      {controls && !children && (
        <div style={barStyle}>
          <button
            type="button"
            onClick={() => (active ? stop() : start(title))}
            style={{ ...btnStyle, background: active ? '#c0392b' : '#2d7d46' }}
          >
            {active ? '■ Stop' : '● Record'}
          </button>
          <button
            type="button"
            onClick={() => (isPaused ? resume() : pause())}
            disabled={!active}
            style={{
              ...btnStyle,
              background: '#3a3a3a',
              opacity: active ? 1 : 0.4,
              cursor: active ? 'pointer' : 'default',
            }}
          >
            {isPaused ? 'Resume' : 'Pause'}
          </button>
          <span style={{ fontVariantNumeric: 'tabular-nums', color: '#aaa' }}>
            {isRecording ? '● ' : ''}
            {formatTime(duration)}
          </span>
          <span style={{ marginLeft: 'auto', color: '#777', fontSize: 12 }}>
            {eventCount.toLocaleString()} events
          </span>
        </div>
      )}

      <div style={{ height, minHeight: 0 }}>
        <Editor
          height="100%"
          defaultLanguage={language}
          defaultValue={defaultValue}
          theme={theme}
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
