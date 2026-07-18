import { useState, useCallback, useRef, useEffect } from 'react';
import { RecordingManager, RecordingState } from '@repo/openscrim-core';
import type {
  RecordingSessionState,
  RecordingSession,
} from '@repo/openscrim-core';
import { MonacoRecorder } from '@repo/openscrim-monaco';
import type * as monacoType from 'monaco-editor';
import { formatDuration } from '@/lib/formatDuration';

export interface UseRecordingProps {
  autoSave?: boolean;
  onSessionComplete?: (session: RecordingSession) => void;
  onError?: (error: Error) => void;
}

export interface UseRecordingReturn {
  sessionState: RecordingSessionState;
  isRecording: boolean;
  isPaused: boolean;
  currentDuration: number;
  eventCount: number;

  startRecording: (title?: string) => void;
  pauseRecording: () => void;
  resumeRecording: () => void;
  stopRecording: () => RecordingSession | null;

  handleEditorMount: (
    editor: monacoType.editor.IStandaloneCodeEditor,
    monaco: typeof monacoType
  ) => void;

  formatDuration: (ms: number) => string;
  getRecordingManager: () => RecordingManager;
}

export function useRecording({
  autoSave = false,
  onSessionComplete,
  onError,
}: UseRecordingProps): UseRecordingReturn {
  const managerRef = useRef<RecordingManager | null>(null);
  const getManager = useCallback(() => {
    if (!managerRef.current) {
      managerRef.current = new RecordingManager();
    }
    return managerRef.current;
  }, []);
  const recorderRef = useRef<MonacoRecorder | null>(null);

  const [sessionState, setSessionState] = useState<RecordingSessionState>({
    sessionId: null,
    state: RecordingState.IDLE,
    startTime: null,
    pausedTime: 0,
    currentDuration: 0,
    eventCount: 0,
    lastEventTimestamp: null,
  });

  const [currentDuration, setCurrentDuration] = useState(0);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const updateSessionState = useCallback(() => {
    const manager = getManager();
    setSessionState(manager.getRecordingState());
    setCurrentDuration(manager.getCurrentDuration());
  }, [getManager]);

  const startRecording = useCallback(
    (title: string = 'Untitled Session') => {
      try {
        const recorder = recorderRef.current;
        if (!recorder) {
          throw new Error('Editor is not ready yet');
        }

        const sessionId = recorder.start(title);
        updateSessionState();

        durationIntervalRef.current = setInterval(() => {
          setCurrentDuration(getManager().getCurrentDuration());
        }, 100);

        console.log(`Started recording session: ${sessionId}`);
      } catch (error) {
        onError?.(error as Error);
      }
    },
    [updateSessionState, onError, getManager]
  );

  const pauseRecording = useCallback(() => {
    try {
      recorderRef.current?.pause();
      updateSessionState();

      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
        durationIntervalRef.current = null;
      }
    } catch (error) {
      onError?.(error as Error);
    }
  }, [updateSessionState, onError]);

  const resumeRecording = useCallback(() => {
    try {
      recorderRef.current?.resume();
      updateSessionState();

      durationIntervalRef.current = setInterval(() => {
        setCurrentDuration(getManager().getCurrentDuration());
      }, 100);
    } catch (error) {
      onError?.(error as Error);
    }
  }, [updateSessionState, onError, getManager]);

  const stopRecording = useCallback(() => {
    try {
      const recorder = recorderRef.current;
      if (!recorder) return null;

      const session = recorder.stop();
      updateSessionState();

      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
        durationIntervalRef.current = null;
      }

      if (session) {
        onSessionComplete?.(session);

        if (autoSave) {
          console.log('Auto-saving recording session:', session.id);
        }
      }

      return session;
    } catch (error) {
      onError?.(error as Error);
      return null;
    }
  }, [updateSessionState, onSessionComplete, autoSave, onError]);

  const handleEditorMount = useCallback(
    (
      editor: monacoType.editor.IStandaloneCodeEditor,
      monaco: typeof monacoType
    ) => {
      recorderRef.current?.dispose();
      recorderRef.current = new MonacoRecorder(editor, monaco, {
        manager: getManager(),
      });
    },
    [getManager]
  );

  useEffect(() => {
    return () => {
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
      recorderRef.current?.dispose();
    };
  }, []);

  return {
    sessionState,
    isRecording: sessionState.state === RecordingState.RECORDING,
    isPaused: sessionState.state === RecordingState.PAUSED,
    currentDuration,
    eventCount: sessionState.eventCount,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    handleEditorMount,
    formatDuration: (ms: number) => formatDuration(ms, 'timer'),
    getRecordingManager: getManager,
  };
}
