import monacoLoaderModule from '@monaco-editor/loader';
import type * as monacoType from 'monaco-editor';

interface MonacoLoader {
  config(options: { paths?: { vs?: string } }): void;
  init(): Promise<typeof monacoType>;
}

// @monaco-editor/loader is CJS; depending on the consumer's interop the
// default import is either the loader itself or a { default } wrapper.
const loader: MonacoLoader =
  (monacoLoaderModule as unknown as { default?: MonacoLoader }).default ??
  (monacoLoaderModule as unknown as MonacoLoader);
import {
  PlaybackEngine,
  PlaybackState,
  parseTantricaBytes,
  tantricaFileToSession,
  type MousePointerEvent,
  type PlaybackPosition,
  type RecordingSession,
  type TantricaFile,
} from '@thisisayande/openscrim-core';
import { attachPlayback } from '@thisisayande/openscrim-monaco';
import { injectStyles } from './styles.js';

export interface PlayerOptions {
  /** URL of a `.tantrica` (or plain-JSON) recording to fetch. */
  src?: string;
  /** Alternatively, a session or parsed file you already have in memory. */
  session?: RecordingSession;
  file?: TantricaFile;
  autoplay?: boolean;
  /** Initial playback speed (0.25–4). */
  speed?: number;
  theme?: 'dark' | 'light';
  /** Player height (any CSS size). Defaults to the container's height, or 480px. */
  height?: string;
  /**
   * Bring your own Monaco instance (skips CDN loading). Useful when the host
   * page already ships monaco-editor.
   */
  monaco?: typeof monacoType;
  /** Override the CDN path monaco is loaded from. */
  monacoVsPath?: string;
}

export interface Player {
  engine: PlaybackEngine;
  editor: monacoType.editor.IStandaloneCodeEditor;
  session: RecordingSession;
  play(): void;
  pause(): void;
  seek(timeMs: number): void;
  setSpeed(speed: number): void;
  destroy(): void;
}

function formatTime(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

async function resolveSession(options: PlayerOptions): Promise<RecordingSession> {
  if (options.session) return options.session;
  if (options.file) return tantricaFileToSession(options.file);
  if (options.src) {
    const response = await fetch(options.src);
    if (!response.ok) {
      throw new Error(`Failed to fetch recording: HTTP ${response.status}`);
    }
    const bytes = new Uint8Array(await response.arrayBuffer());
    return tantricaFileToSession(await parseTantricaBytes(bytes));
  }
  throw new Error('createPlayer needs one of: src, session, or file');
}

async function resolveMonaco(options: PlayerOptions): Promise<typeof monacoType> {
  if (options.monaco) return options.monaco;
  if (options.monacoVsPath) {
    loader.config({ paths: { vs: options.monacoVsPath } });
  }
  return loader.init();
}

export async function createPlayer(
  container: HTMLElement,
  options: PlayerOptions = {}
): Promise<Player> {
  const doc = container.ownerDocument;
  injectStyles(doc);

  const theme = options.theme ?? 'dark';
  container.innerHTML = '';

  const root = doc.createElement('div');
  root.className = 'osp-root';
  root.dataset.theme = theme;
  root.style.height = options.height ?? (container.style.height || '480px');
  container.appendChild(root);

  const editorHost = doc.createElement('div');
  editorHost.className = 'osp-editor';
  root.appendChild(editorHost);

  const pointerDot = doc.createElement('div');
  pointerDot.className = 'osp-pointer';
  editorHost.appendChild(pointerDot);

  const hint = doc.createElement('div');
  hint.className = 'osp-hint';
  hint.textContent = 'Paused — edit freely, play to resume';
  root.appendChild(hint);

  const controls = doc.createElement('div');
  controls.className = 'osp-controls';
  controls.innerHTML = `
    <button class="osp-btn" data-osp="toggle" aria-label="Play">▶</button>
    <span class="osp-time" data-osp="time">0:00 / 0:00</span>
    <input class="osp-seek" data-osp="seek" type="range" min="0" max="1000" value="0" aria-label="Seek" />
    <select class="osp-speed" data-osp="speed" aria-label="Playback speed">
      <option value="0.5">0.5×</option>
      <option value="1" selected>1×</option>
      <option value="1.5">1.5×</option>
      <option value="2">2×</option>
    </select>
  `;
  root.appendChild(controls);

  const toggleBtn = controls.querySelector<HTMLButtonElement>('[data-osp="toggle"]')!;
  const timeLabel = controls.querySelector<HTMLSpanElement>('[data-osp="time"]')!;
  const seekBar = controls.querySelector<HTMLInputElement>('[data-osp="seek"]')!;
  const speedSelect = controls.querySelector<HTMLSelectElement>('[data-osp="speed"]')!;

  let session: RecordingSession;
  let monaco: typeof monacoType;
  try {
    [session, monaco] = await Promise.all([
      resolveSession(options),
      resolveMonaco(options),
    ]);
  } catch (error) {
    editorHost.innerHTML = `<div class="osp-error">Could not load recording: ${
      error instanceof Error ? error.message : String(error)
    }</div>`;
    throw error;
  }

  const editor = monaco.editor.create(editorHost, {
    value: session.initialContent,
    language: session.language,
    theme: theme === 'light' ? 'vs' : 'vs-dark',
    readOnly: true,
    minimap: { enabled: false },
    automaticLayout: true,
    fontSize: session.metadata?.fontSize ?? 14,
    tabSize: session.metadata?.tabSize ?? 2,
    scrollBeyondLastLine: false,
  });

  const engine = new PlaybackEngine();
  const attachment = attachPlayback(editor, monaco, engine);

  let seeking = false;
  let totalTime = 0;

  const renderPosition = (position: PlaybackPosition) => {
    totalTime = position.totalTime;
    timeLabel.textContent = `${formatTime(position.currentTime)} / ${formatTime(position.totalTime)}`;
    if (!seeking) {
      seekBar.value = String(Math.round(position.progress * 1000));
    }
  };

  const setPausedUi = (paused: boolean) => {
    toggleBtn.textContent = paused ? '▶' : '⏸';
    toggleBtn.setAttribute('aria-label', paused ? 'Play' : 'Pause');
    hint.style.display = paused ? 'block' : 'none';
    editor.updateOptions({ readOnly: !paused });
  };

  const engineHandler: Parameters<PlaybackEngine['addEventHandler']>[0] = ({
    type,
    data,
  }) => {
    if (type === 'positionUpdate') {
      renderPosition(data as PlaybackPosition);
    } else if (type === 'stateChange') {
      const state = (data as { state: PlaybackState }).state;
      setPausedUi(state !== PlaybackState.PLAYING);
    } else if (type === 'eventProcessed') {
      const payload = data as { type: string; event?: MousePointerEvent };
      if (payload.type === 'pointer' && payload.event) {
        pointerDot.style.display = 'block';
        pointerDot.style.left = `${payload.event.x * 100}%`;
        pointerDot.style.top = `${payload.event.y * 100}%`;
      }
    }
  };
  engine.addEventHandler(engineHandler);
  engine.loadSession(session);
  renderPosition(engine.getPosition());
  setPausedUi(true);

  const play = () => {
    // The viewer may have edited while paused; a seek to the current time
    // re-renders the engine's canonical content before events resume.
    engine.seek(engine.getPosition().currentTime);
    engine.play();
  };

  toggleBtn.addEventListener('click', () => {
    if (engine.getState() === PlaybackState.PLAYING) {
      engine.pause();
    } else {
      play();
    }
  });

  seekBar.addEventListener('input', () => {
    seeking = true;
  });
  seekBar.addEventListener('change', () => {
    seeking = false;
    engine.seek((Number(seekBar.value) / 1000) * totalTime);
  });

  speedSelect.addEventListener('change', () => {
    engine.setSpeed(Number(speedSelect.value));
  });

  if (options.speed) {
    engine.setSpeed(options.speed);
    speedSelect.value = String(engine.getOptions().speed);
  }
  if (options.autoplay) {
    engine.play();
  }

  return {
    engine,
    editor,
    session,
    play,
    pause: () => engine.pause(),
    seek: (timeMs: number) => engine.seek(timeMs),
    setSpeed: (speed: number) => engine.setSpeed(speed),
    destroy() {
      attachment.detach();
      engine.removeEventHandler(engineHandler);
      engine.destroy();
      editor.dispose();
      container.innerHTML = '';
    },
  };
}
