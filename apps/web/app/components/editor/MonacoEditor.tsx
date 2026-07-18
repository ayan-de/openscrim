'use client';

import { Editor } from '@monaco-editor/react';
import React, { useState } from 'react';
import type * as monacoType from 'monaco-editor';
import { useRecording } from '@/hooks/useRecordings';
import { useLoading } from '@/context/LoadingContext';
import type { RecordingSession } from '@repo/openscrim-core';
import { env } from '@/config/env';
import { getRecordingStorage } from '@/lib/storage';
import { useAuth } from '@/hooks/useAuth';

interface MonacoEditorProps {
  initialTitle?: string;
}

export default function MonacoEditor({
  initialTitle = '',
}: MonacoEditorProps): React.JSX.Element {
  const [value, setValue] = useState(
    '// Welcome to the Interactive Code Editor\n// Start typing your code here...\n\nfunction hello() {\n  console.log("Hello World!");\n}\n\n// Click "Start Recording" to begin capturing your coding session\n// All your keystrokes, cursor movements, and selections will be recorded'
  );

  const [sessionTitle, setSessionTitle] = useState(
    initialTitle || 'First Coding Session'
  );

  const { showSuccess, showError } = useLoading();
  const { isAuthenticated } = useAuth();
  const storage = getRecordingStorage(() => isAuthenticated);

  const {
    isRecording,
    isPaused,
    currentDuration,
    eventCount,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    handleEditorMount: recordingHandleEditorMount,
    formatDuration,
  } = useRecording({
    autoSave: env.AUTO_SAVE_RECORDINGS,
    onSessionComplete: async (session: RecordingSession) => {
      if (env.isDevelopment() && env.DEBUG_RECORDING) {
        console.log('recording completed', session);
      }

      try {
        await storage.save(session);
        window.dispatchEvent(new CustomEvent('recording_saved'));
      } catch (err) {
        console.error('Failed to save recording:', err);
      }

      showSuccess(
        `Recording saved! Duration: ${formatDuration(session.duration)}, Events: ${session.events.length}`
      );
    },
    onError: (error: Error) => {
      console.error(' Recording error:', error);
      showError(`Recording error: ${error.message}`);
    },
  });

  const handleEditorChange = (newValue: string | undefined) => {
    setValue(newValue || '');
  };

  function handleEditorDidMount(
    editor: monacoType.editor.IStandaloneCodeEditor,
    monaco: typeof monacoType
  ) {
    if (env.isDevelopment() && env.DEBUG_MONACO) {
      console.log('onMount: the editor instance:', editor);
      console.log('onMount: the monaco instance:', monaco);
    }

    recordingHandleEditorMount(editor, monaco);
  }

  const handleStartRecording = () => {
    startRecording(sessionTitle);
  };

  const handlePauseResume = () => {
    if (isPaused) {
      resumeRecording();
    } else {
      pauseRecording();
    }
  };

  const handleStopRecording = () => {
    stopRecording();
  };

  return (
    <div className="w-full h-full flex flex-col gap-4">
      <div className="bg-card text-card-foreground p-4 rounded-lg border border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <input
              type="text"
              value={sessionTitle}
              onChange={(e) => setSessionTitle(e.target.value)}
              placeholder="Session title..."
              disabled={isRecording || isPaused}
              className="px-3 py-1 bg-input border border-border rounded text-sm text-foreground placeholder-muted-foreground disabled:opacity-50"
            />

            <button
              onClick={handleStartRecording}
              disabled={isRecording || isPaused}
              className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 disabled:bg-muted disabled:cursor-not-allowed text-primary-foreground rounded-md text-sm font-medium transition-colors"
            >
              <div
                className={`w-3 h-3 rounded-full ${isRecording ? 'bg-primary-foreground/70 animate-pulse' : 'bg-primary-foreground'}`}
              />
              {isRecording ? 'Recording...' : 'Start Recording'}
            </button>

            <button
              onClick={handlePauseResume}
              disabled={!isRecording && !isPaused}
              className="px-4 py-2 bg-destructive hover:bg-destructive/90 disabled:bg-muted disabled:cursor-not-allowed text-destructive-foreground rounded-md text-sm font-medium transition-colors"
            >
              {isPaused ? 'Resume' : 'Pause'}
            </button>

            <button
              onClick={handleStopRecording}
              disabled={!isRecording && !isPaused}
              className="px-4 py-2 bg-destructive hover:bg-destructive/90 disabled:bg-muted disabled:cursor-not-allowed text-destructive-foreground rounded-md text-sm font-medium transition-colors"
            >
              Stop
            </button>
          </div>

          <div className="flex items-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Status:</span>
              <span
                className={`font-semibold ${
                  isRecording
                    ? 'text-primary'
                    : isPaused
                      ? 'text-muted-foreground'
                      : 'text-muted-foreground'
                }`}
              >
                {isRecording ? 'Recording' : isPaused ? 'Paused' : 'Idle'}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Duration:</span>
              <span className="font-mono text-foreground">
                {formatDuration(currentDuration)}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Events:</span>
              <span className="font-mono text-foreground">
                {eventCount.toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        {(isRecording || isPaused) && (
          <div className="mt-3">
            <div className="h-1 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-200 ${
                  isRecording ? 'bg-primary' : 'bg-muted-foreground'
                }`}
                style={{
                  width: `${Math.min((currentDuration / env.MAX_RECORDING_DURATION) * 100, 100)}%`,
                }}
              />
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {isRecording ? 'Recording in progress...' : 'Recording paused'}
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 border border-border rounded-lg overflow-hidden">
        <Editor
          height="100%"
          width="100%"
          defaultLanguage="javascript"
          value={value}
          onChange={handleEditorChange}
          theme="vs-dark"
          options={{
            minimap: { enabled: false },
            fontSize: 20,
            wordWrap: 'on',
            automaticLayout: true,
            scrollBeyondLastLine: false,
            smoothScrolling: true,
            cursorBlinking: 'smooth',
            renderLineHighlight: 'gutter',
            contextmenu: true,
            mouseWheelZoom: true,
            selectOnLineNumbers: true,
            lineNumbers: 'on',
            glyphMargin: false,
            folding: true,
            lineDecorationsWidth: 0,
            lineNumbersMinChars: 3,
            renderValidationDecorations: 'on',
          }}
          onMount={handleEditorDidMount}
        />
      </div>
    </div>
  );
}
