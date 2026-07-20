import { useCallback, useEffect, useRef, useState } from 'react';
import { PlaybackEngine, PlaybackState } from '@thisisayande/openscrim-core';
import type {
  MousePointerEvent,
  PlaybackPosition,
  RecordingSession,
} from '@thisisayande/openscrim-core';
import { attachPlayback } from '@thisisayande/openscrim-monaco';
import type { PlaybackAttachment } from '@thisisayande/openscrim-monaco';
import type * as monacoType from 'monaco-editor';
import type { EditorMountHandler } from './useRecorder.js';

const ZERO_POSITION: PlaybackPosition = {
  currentTime: 0,
  totalTime: 0,
  progress: 0,
  currentEventIndex: 0,
};

export interface UsePlayerOptions {
  /** The recording to play. Playback (re)loads whenever this changes. */
  session?: RecordingSession | null;
  autoplay?: boolean;
  /** Initial playback speed (0.25–4). */
  speed?: number;
  /**
   * When true (default), the editor becomes editable while paused so viewers
   * can fork the instructor's code; resuming re-applies the canonical content.
   */
  editWhilePaused?: boolean;
  /** Fires when playback replaces/edits the editor content. */
  onContentRendered?: (content: string) => void;
  /** Fires on recorded pointer events — render your own cursor/trail overlay. */
  onPointer?: (pointer: MousePointerEvent) => void;
}

export interface UsePlayerResult {
  position: PlaybackPosition;
  state: PlaybackState;
  isPlaying: boolean;
  play: () => void;
  pause: () => void;
  seek: (timeMs: number) => void;
  setSpeed: (speed: number) => void;
  /** Wire into `<Editor onMount={...}>`. */
  onMount: EditorMountHandler;
  getEngine: () => PlaybackEngine;
}

/**
 * Headless playback hook. Owns a PlaybackEngine, renders processed events into
 * a mounted Monaco editor, and surfaces reactive position/state. Transport UI,
 * pointer overlays and persistence are left to the caller.
 */
export function usePlayer(options: UsePlayerOptions = {}): UsePlayerResult {
  const { session, autoplay, speed, editWhilePaused = true } = options;

  const engineRef = useRef<PlaybackEngine | null>(null);
  const editorRef = useRef<monacoType.editor.IStandaloneCodeEditor | null>(
    null
  );
  const attachmentRef = useRef<PlaybackAttachment | null>(null);

  const onContentRenderedRef = useRef(options.onContentRendered);
  const onPointerRef = useRef(options.onPointer);
  onContentRenderedRef.current = options.onContentRendered;
  onPointerRef.current = options.onPointer;

  const [position, setPosition] = useState<PlaybackPosition>(ZERO_POSITION);
  const [state, setState] = useState<PlaybackState>(PlaybackState.IDLE);

  const getEngine = useCallback(() => {
    if (!engineRef.current) {
      const engine = new PlaybackEngine();
      engine.addEventHandler(({ type, data }) => {
        if (type === 'positionUpdate') {
          setPosition(data as PlaybackPosition);
        } else if (type === 'stateChange') {
          const next = (data as { state: PlaybackState }).state;
          setState(next);
          if (editWhilePaused && editorRef.current) {
            editorRef.current.updateOptions({
              readOnly: next === PlaybackState.PLAYING,
            });
          }
        } else if (type === 'eventProcessed') {
          const payload = data as { type: string; event?: MousePointerEvent };
          if (payload.type === 'pointer' && payload.event) {
            onPointerRef.current?.(payload.event);
          }
        }
      });
      engineRef.current = engine;
    }
    return engineRef.current;
  }, [editWhilePaused]);

  // (Re)load whenever the session changes.
  useEffect(() => {
    if (!session) return;
    const engine = getEngine();
    engine.loadSession(session);
    setPosition(engine.getPosition());
    if (speed) engine.setSpeed(speed);
    if (autoplay) engine.play();
    // autoplay/speed are start-of-session intents, not live-reactive knobs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, getEngine]);

  const onMount = useCallback<EditorMountHandler>(
    (editor, monaco) => {
      editorRef.current = editor;
      attachmentRef.current?.detach();
      attachmentRef.current = attachPlayback(editor, monaco, getEngine(), {
        onContentRendered: (content) => onContentRenderedRef.current?.(content),
      });
      editor.updateOptions({ readOnly: true });
    },
    [getEngine]
  );

  const play = useCallback(() => {
    const engine = getEngine();
    // The viewer may have edited while paused; re-seek to the current time so
    // the engine's canonical content is restored before events resume.
    engine.seek(engine.getPosition().currentTime);
    engine.play();
  }, [getEngine]);

  const pause = useCallback(() => getEngine().pause(), [getEngine]);
  const seek = useCallback(
    (timeMs: number) => getEngine().seek(timeMs),
    [getEngine]
  );
  const setSpeed = useCallback(
    (value: number) => getEngine().setSpeed(value),
    [getEngine]
  );

  useEffect(() => {
    return () => {
      attachmentRef.current?.detach();
      engineRef.current?.destroy();
    };
  }, []);

  return {
    position,
    state,
    isPlaying: state === PlaybackState.PLAYING,
    play,
    pause,
    seek,
    setSpeed,
    onMount,
    getEngine,
  };
}
