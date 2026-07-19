import {
  RecordingEvent,
  RecordingEventType,
  RecordingSession,
  ContentChangeEvent,
  FileChangeEvent,
  CursorPositionEvent,
  SelectionChangeEvent,
  KeystrokeEvent,
  LanguageChangeEvent,
  Range,
} from './types.js';

export enum PlaybackState {
  IDLE = 'idle',
  PLAYING = 'playing',
  PAUSED = 'paused',
  STOPPED = 'stopped',
  SEEKING = 'seeking',
}

export interface PlaybackPosition {
  currentTime: number;
  totalTime: number;
  currentEventIndex: number;
  progress: number;
}

export interface PlaybackOptions {
  speed: number;
  skipPauses: boolean;
  autoLoop: boolean;
}

export type PlaybackEventHandler = (event: {
  type: 'stateChange' | 'positionUpdate' | 'eventProcessed' | 'error';
  data: any;
}) => void;

export interface SchedulerOptions {
  requestAnimationFrame: (cb: (time: number) => void) => number;
  cancelAnimationFrame: (id: number) => void;
  performanceNow: () => number;
}

const DEFAULT_SCHEDULER: SchedulerOptions = {
  requestAnimationFrame:
    typeof globalThis.requestAnimationFrame !== 'undefined'
      ? (cb: (time: number) => void) => globalThis.requestAnimationFrame(cb)
      : (cb) =>
          (globalThis as any).setTimeout
            ? ((globalThis as any).setTimeout(
                () => cb(Date.now()),
                16
              ) as unknown as number)
            : 0,
  cancelAnimationFrame:
    typeof globalThis.cancelAnimationFrame !== 'undefined'
      ? (id: number) => globalThis.cancelAnimationFrame(id)
      : (id: number) => {
          if ((globalThis as any).clearTimeout)
            (globalThis as any).clearTimeout(id);
        },
  performanceNow:
    typeof globalThis.performance !== 'undefined'
      ? () => globalThis.performance.now()
      : () => Date.now(),
};

export class PlaybackEngine {
  private session: RecordingSession | null = null;
  private state: PlaybackState = PlaybackState.IDLE;
  private position: PlaybackPosition = {
    currentTime: 0,
    totalTime: 0,
    currentEventIndex: 0,
    progress: 0,
  };
  private options: PlaybackOptions = {
    speed: 1,
    skipPauses: false,
    autoLoop: false,
  };

  private eventHandlers: Set<PlaybackEventHandler> = new Set();
  private rafId: number | null = null;
  private lastUpdateTime: number = 0;
  private startTime: number = 0;
  private scheduler: SchedulerOptions;

  private snapshots: Map<number, { content: string; language: string }> =
    new Map();
  private currentContent: string = '';
  private currentLanguage: string = '';
  private snapshotInterval: number = 50;

  constructor(scheduler?: Partial<SchedulerOptions>) {
    this.scheduler = { ...DEFAULT_SCHEDULER, ...scheduler };
    this.reset();
  }

  public addEventHandler(handler: PlaybackEventHandler): void {
    this.eventHandlers.add(handler);
  }

  public removeEventHandler(handler: PlaybackEventHandler): void {
    this.eventHandlers.delete(handler);
  }

  private emit(
    type: 'stateChange' | 'positionUpdate' | 'eventProcessed' | 'error',
    data: any
  ): void {
    this.eventHandlers.forEach((handler) => {
      try {
        handler({ type, data });
      } catch (error) {
        console.error('Error in playback event handler:', error);
      }
    });
  }

  public loadSession(session: RecordingSession): void {
    this.stop();
    this.session = session;

    if (session.events.length > 0) {
      const firstEvent = session.events[0];
      const lastEvent = session.events[session.events.length - 1];
      if (firstEvent && lastEvent) {
        this.position.totalTime = lastEvent.timestamp - firstEvent.timestamp;
      } else {
        this.position.totalTime = session.duration;
      }
    } else {
      this.position.totalTime = session.duration;
    }

    this.snapshots.clear();
    this.currentContent = '';
    this.currentLanguage = '';

    this.reset();
    this.emit('stateChange', { state: this.state, session });
  }

  public getSession(): RecordingSession | null {
    return this.session;
  }

  public play(): void {
    if (!this.session || this.session.events.length === 0) {
      this.emit('error', { message: 'No session loaded or session is empty' });
      return;
    }

    if (this.state === PlaybackState.PLAYING) {
      return;
    }

    if (this.position.currentEventIndex >= this.session.events.length) {
      this.seek(0);
    }

    this.state = PlaybackState.PLAYING;
    this.startTime =
      Date.now() - this.position.currentTime / this.options.speed;

    this.startPlaybackLoop();
    this.emit('stateChange', { state: this.state });
  }

  public pause(): void {
    if (this.state !== PlaybackState.PLAYING) {
      return;
    }

    this.state = PlaybackState.PAUSED;
    this.stopPlaybackLoop();
    this.emit('stateChange', { state: this.state });
  }

  public stop(): void {
    if (this.state === PlaybackState.IDLE) {
      return;
    }

    this.state = PlaybackState.STOPPED;
    this.stopPlaybackLoop();
    this.seek(0);
    this.emit('stateChange', { state: this.state });
  }

  public seek(timeMs: number): void {
    if (!this.session) {
      return;
    }

    const wasPlaying = this.state === PlaybackState.PLAYING;
    if (wasPlaying) {
      this.stopPlaybackLoop();
    }

    this.state = PlaybackState.SEEKING;

    timeMs = Math.max(0, Math.min(timeMs, this.position.totalTime));

    const firstEvent =
      this.session.events.length > 0 ? this.session.events[0] : null;
    const firstEventTime = firstEvent ? firstEvent.timestamp : 0;
    const targetTime = firstEventTime + timeMs;

    let eventIndex = 0;
    for (let i = 0; i < this.session.events.length; i++) {
      const event = this.session.events[i];
      if (event && event.timestamp <= targetTime) {
        eventIndex = i;
      } else {
        break;
      }
    }

    this.position.currentTime = timeMs;
    this.position.currentEventIndex = eventIndex;
    this.position.progress =
      this.position.totalTime > 0 ? timeMs / this.position.totalTime : 0;

    this.applyEventsUpToIndex(eventIndex);

    this.emit('positionUpdate', { ...this.position });

    if (wasPlaying) {
      this.state = PlaybackState.PLAYING;
      this.startTime =
        Date.now() - this.position.currentTime / this.options.speed;
      this.startPlaybackLoop();
    } else {
      this.state = PlaybackState.PAUSED;
    }

    this.emit('stateChange', { state: this.state });
  }

  public setSpeed(speed: number): void {
    const wasPlaying = this.state === PlaybackState.PLAYING;
    if (wasPlaying) {
      this.pause();
    }

    this.options.speed = Math.max(0.25, Math.min(speed, 4));

    if (wasPlaying) {
      this.play();
    }
  }

  public setOptions(options: Partial<PlaybackOptions>): void {
    this.options = { ...this.options, ...options };
  }

  public getState(): PlaybackState {
    return this.state;
  }

  public getPosition(): PlaybackPosition {
    return { ...this.position };
  }

  public getOptions(): PlaybackOptions {
    return { ...this.options };
  }

  private reset(): void {
    this.position = {
      currentTime: 0,
      totalTime: this.position.totalTime,
      currentEventIndex: 0,
      progress: 0,
    };
    this.state = PlaybackState.IDLE;
  }

  private startPlaybackLoop(): void {
    this.stopPlaybackLoop();
    this.lastUpdateTime = this.scheduler.performanceNow();
    const tick = (now: number) => {
      this.lastUpdateTime = now;
      this.updatePlayback();
      if (this.state === PlaybackState.PLAYING) {
        this.rafId = this.scheduler.requestAnimationFrame(tick);
      }
    };
    this.rafId = this.scheduler.requestAnimationFrame(tick);
  }

  private stopPlaybackLoop(): void {
    if (this.rafId !== null) {
      this.scheduler.cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  private updatePlayback(): void {
    if (!this.session || this.state !== PlaybackState.PLAYING) {
      return;
    }

    const now = Date.now();
    const realTimeElapsed = now - this.startTime;
    this.position.currentTime = realTimeElapsed * this.options.speed;

    this.position.progress =
      this.position.totalTime > 0
        ? Math.min(1, this.position.currentTime / this.position.totalTime)
        : 0;

    const firstEvent =
      this.session.events.length > 0 ? this.session.events[0] : null;
    const firstEventTime = firstEvent ? firstEvent.timestamp : 0;
    const targetTime = firstEventTime + this.position.currentTime;

    while (this.position.currentEventIndex < this.session.events.length) {
      const currentEvent = this.session.events[this.position.currentEventIndex];
      if (!currentEvent || currentEvent.timestamp > targetTime) {
        break;
      }
      this.processEvent(currentEvent);
      this.position.currentEventIndex++;
    }

    if (this.position.currentEventIndex >= this.session.events.length) {
      if (this.options.autoLoop) {
        this.seek(0);
        return;
      } else {
        this.pause();
        return;
      }
    }

    this.emit('positionUpdate', { ...this.position });
  }

  private applyEventsUpToIndex(index: number): void {
    if (!this.session) return;

    let snapshotIndex = -1;
    for (let i = index; i >= 0; i -= this.snapshotInterval) {
      const snap = this.snapshots.get(i);
      if (snap) {
        snapshotIndex = i;
        this.currentContent = snap.content;
        this.currentLanguage = snap.language;
        break;
      }
    }

    if (snapshotIndex === -1) {
      this.currentContent = this.session.initialContent;
      this.currentLanguage = this.session.language;
    }

    this.emit('eventProcessed', {
      type: 'reset',
      content: this.currentContent,
      language: this.currentLanguage,
    });

    const startIndex = snapshotIndex + 1;
    for (
      let i = startIndex;
      i <= index && i < this.session.events.length;
      i++
    ) {
      const event = this.session.events[i];
      if (event) {
        this.processEvent(event);
      }
    }
  }

  private processEvent(event: RecordingEvent): void {
    try {
      switch (event.type) {
        case RecordingEventType.CONTENT_CHANGE: {
          const contentEvent = event as ContentChangeEvent;
          for (const change of contentEvent.changes) {
            this.currentContent = this.applyTextChange(
              this.currentContent,
              change
            );
          }
          this.emit('eventProcessed', {
            type: 'contentChange',
            event: contentEvent,
          });
          if (
            this.session &&
            this.position.currentEventIndex % this.snapshotInterval === 0
          ) {
            this.snapshots.set(this.position.currentEventIndex, {
              content: this.currentContent,
              language: this.currentLanguage,
            });
          }
          break;
        }

        case RecordingEventType.FILE_CHANGE: {
          const fileEvent = event as FileChangeEvent;
          if (fileEvent.content !== undefined) {
            this.currentContent = fileEvent.content;
          }
          if (fileEvent.language) {
            this.currentLanguage = fileEvent.language;
          }
          this.emit('eventProcessed', {
            type: 'fileChange',
            event: fileEvent,
          });
          break;
        }

        case RecordingEventType.SCROLL:
          this.emit('eventProcessed', { type: 'scroll', event });
          break;

        case RecordingEventType.POINTER:
          this.emit('eventProcessed', { type: 'pointer', event });
          break;

        case RecordingEventType.CURSOR_POSITION:
          this.emit('eventProcessed', {
            type: 'cursorPosition',
            event: event as CursorPositionEvent,
          });
          break;

        case RecordingEventType.SELECTION_CHANGE:
          this.emit('eventProcessed', {
            type: 'selectionChange',
            event: event as SelectionChangeEvent,
          });
          break;

        case RecordingEventType.KEYSTROKE:
          this.emit('eventProcessed', {
            type: 'keystroke',
            event: event as KeystrokeEvent,
          });
          break;

        case RecordingEventType.LANGUAGE_CHANGE: {
          const langEvent = event as LanguageChangeEvent;
          this.currentLanguage = langEvent.language;
          this.emit('eventProcessed', {
            type: 'languageChange',
            event: langEvent,
          });
          break;
        }

        case RecordingEventType.RECORDING_START:
        case RecordingEventType.RECORDING_PAUSE:
        case RecordingEventType.RECORDING_RESUME:
        case RecordingEventType.RECORDING_STOP:
        case RecordingEventType.EDITOR_FOCUS:
        case RecordingEventType.EDITOR_BLUR:
          break;

        default:
          console.warn(
            'Unknown event type during playback:',
            (event as any).type
          );
          break;
      }
    } catch (error) {
      console.error('Error processing event:', error, event);
      this.emit('error', { message: 'Error processing event', event, error });
    }
  }

  private applyTextChange(
    content: string,
    change: { range: Range; text: string }
  ): string {
    const lines = content.split('\n');
    const { startLineNumber, startColumn, endLineNumber, endColumn } =
      change.range;

    const beforeLines = lines.slice(0, startLineNumber - 1);
    const afterLines = lines.slice(endLineNumber);

    const startLine = lines[startLineNumber - 1] || '';
    const endLine = lines[endLineNumber - 1] || '';

    const beforeText = startLine.substring(0, startColumn - 1);
    const afterText = endLine.substring(endColumn - 1);

    const newLines = (beforeText + change.text + afterText).split('\n');

    return [...beforeLines, ...newLines, ...afterLines].join('\n');
  }

  public destroy(): void {
    this.stop();
    this.eventHandlers.clear();
    this.session = null;
    this.snapshots.clear();
    this.currentContent = '';
    this.currentLanguage = '';
  }
}
