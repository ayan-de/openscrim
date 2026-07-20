import { useCallback, useEffect, useRef, useState } from 'react';
import { RecordingManager, RecordingState } from '@thisisayande/openscrim-core';
import type {
  RecordingConfig,
  RecordingSession,
  RecordingSessionState,
} from '@thisisayande/openscrim-core';
import { MonacoRecorder } from '@thisisayande/openscrim-monaco';
import type * as monacoType from 'monaco-editor';

export type EditorMountHandler = (
  editor: monacoType.editor.IStandaloneCodeEditor,
  monaco: typeof monacoType
) => void;

export interface UseRecorderOptions {
  /** Forwarded to the underlying RecordingManager (dedup, throttling, etc.). */
  config?: Partial<RecordingConfig>;
  /**
   * Called with the finished session when recording stops. This is the only
   * hand-off point — the SDK never persists anything itself. Save it to
   * IndexedDB, your API, the OpenScrim cloud, or a `.tantrica` download here.
   */
  onComplete?: (session: RecordingSession) => void;
  onError?: (error: Error) => void;
}

export interface UseRecorderResult {
  state: RecordingSessionState;
  isRecording: boolean;
  isPaused: boolean;
  /** Elapsed recording time in ms, ticking ~10x/sec while active. */
  duration: number;
  eventCount: number;

  start: (title?: string) => void;
  pause: () => void;
  resume: () => void;
  /** Stops and returns the session (also delivered via `onComplete`). */
  stop: () => RecordingSession | null;

  /** Wire into `<Editor onMount={...}>` or a raw `monaco.editor.create` pair. */
  onMount: EditorMountHandler;

  getManager: () => RecordingManager;
  getRecorder: () => MonacoRecorder | null;
}

const IDLE_STATE: RecordingSessionState = {
  sessionId: null,
  state: RecordingState.IDLE,
  startTime: null,
  pausedTime: 0,
  currentDuration: 0,
  eventCount: 0,
  lastEventTimestamp: null,
};

/**
 * Headless recording hook. Owns a RecordingManager + MonacoRecorder and
 * exposes the record/pause/resume/stop lifecycle plus reactive state.
 * Storage is intentionally out of scope — persist via `onComplete`.
 */
export function useRecorder(
  options: UseRecorderOptions = {}
): UseRecorderResult {
  const { config, onComplete, onError } = options;

  const managerRef = useRef<RecordingManager | null>(null);
  const recorderRef = useRef<MonacoRecorder | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Keep the latest callbacks without re-binding onMount on every render.
  const onCompleteRef = useRef(onComplete);
  const onErrorRef = useRef(onError);
  onCompleteRef.current = onComplete;
  onErrorRef.current = onError;

  const [state, setState] = useState<RecordingSessionState>(IDLE_STATE);
  const [duration, setDuration] = useState(0);

  const getManager = useCallback(() => {
    if (!managerRef.current) {
      managerRef.current = new RecordingManager(config);
    }
    return managerRef.current;
  }, [config]);

  const sync = useCallback(() => {
    const manager = getManager();
    setState(manager.getRecordingState());
    setDuration(manager.getCurrentDuration());
  }, [getManager]);

  const startTicking = useCallback(() => {
    if (tickRef.current) return;
    tickRef.current = setInterval(() => {
      setDuration(getManager().getCurrentDuration());
    }, 100);
  }, [getManager]);

  const stopTicking = useCallback(() => {
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
  }, []);

  const start = useCallback(
    (title = 'Untitled Session') => {
      try {
        const recorder = recorderRef.current;
        if (!recorder) throw new Error('Editor is not mounted yet');
        recorder.start(title);
        startTicking();
        sync();
      } catch (error) {
        onErrorRef.current?.(error as Error);
      }
    },
    [startTicking, sync]
  );

  const pause = useCallback(() => {
    try {
      recorderRef.current?.pause();
      stopTicking();
      sync();
    } catch (error) {
      onErrorRef.current?.(error as Error);
    }
  }, [stopTicking, sync]);

  const resume = useCallback(() => {
    try {
      recorderRef.current?.resume();
      startTicking();
      sync();
    } catch (error) {
      onErrorRef.current?.(error as Error);
    }
  }, [startTicking, sync]);

  const stop = useCallback((): RecordingSession | null => {
    try {
      const recorder = recorderRef.current;
      if (!recorder) return null;
      const session = recorder.stop();
      stopTicking();
      sync();
      if (session) onCompleteRef.current?.(session);
      return session;
    } catch (error) {
      onErrorRef.current?.(error as Error);
      return null;
    }
  }, [stopTicking, sync]);

  const onMount = useCallback<EditorMountHandler>(
    (editor, monaco) => {
      recorderRef.current?.dispose();
      recorderRef.current = new MonacoRecorder(editor, monaco, {
        manager: getManager(),
      });
    },
    [getManager]
  );

  useEffect(() => {
    return () => {
      stopTicking();
      recorderRef.current?.dispose();
    };
  }, [stopTicking]);

  return {
    state,
    isRecording: state.state === RecordingState.RECORDING,
    isPaused: state.state === RecordingState.PAUSED,
    duration,
    eventCount: state.eventCount,
    start,
    pause,
    resume,
    stop,
    onMount,
    getManager,
    getRecorder: () => recorderRef.current,
  };
}
