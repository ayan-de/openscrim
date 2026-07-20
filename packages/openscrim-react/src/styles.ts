const STYLE_ID = 'openscrim-react-styles';

/**
 * Overridable design tokens. Pass a partial to any component's `theme` prop to
 * recolor it; unspecified tokens fall back to the `base` palette (dark/light).
 */
export interface OpenScrimTheme {
  base?: 'dark' | 'light';
  accent?: string;
  /** Outer chrome / panels (sidebar, control bar). */
  background?: string;
  /** Editor + content surface. */
  surface?: string;
  border?: string;
  text?: string;
  muted?: string;
}

export type ThemeInput = 'dark' | 'light' | OpenScrimTheme;

const TOKEN_TO_VAR: Record<keyof Omit<OpenScrimTheme, 'base'>, string> = {
  accent: '--os-accent',
  background: '--os-bg',
  surface: '--os-surface',
  border: '--os-border',
  text: '--os-text',
  muted: '--os-muted',
};

export interface ResolvedTheme {
  base: 'dark' | 'light';
  /** CSS custom properties to spread onto the root element's `style`. */
  vars: Record<string, string>;
  /** Monaco theme id implied by the base (override with a `monacoTheme` prop). */
  monaco: 'vs-dark' | 'vs';
}

export function resolveTheme(theme?: ThemeInput): ResolvedTheme {
  if (theme === undefined || typeof theme === 'string') {
    const base = theme ?? 'dark';
    return { base, vars: {}, monaco: base === 'light' ? 'vs' : 'vs-dark' };
  }
  const base = theme.base ?? 'dark';
  const vars: Record<string, string> = {};
  for (const key of Object.keys(TOKEN_TO_VAR) as Array<keyof typeof TOKEN_TO_VAR>) {
    const value = theme[key];
    if (value) vars[TOKEN_TO_VAR[key]] = value;
  }
  return { base, vars, monaco: base === 'light' ? 'vs' : 'vs-dark' };
}

export const OPENSCRIM_CSS = `
.openscrim {
  --os-accent: #e0574d;
  --os-bg: #181818;
  --os-surface: #1e1e1e;
  --os-border: #2c2c2c;
  --os-text: #e6e6e6;
  --os-muted: #8a8a8a;
  --os-accent-contrast: #ffffff;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid var(--os-border);
  border-radius: 8px;
  background: var(--os-surface);
  color: var(--os-text);
  font-family: ui-sans-serif, system-ui, -apple-system, sans-serif;
  font-size: 13px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.18);
}
.openscrim[data-theme='light'] {
  --os-bg: #f5f5f5;
  --os-surface: #ffffff;
  --os-border: #e3e3e3;
  --os-text: #1e1e1e;
  --os-muted: #6f6f6f;
}
.openscrim * { box-sizing: border-box; }

/* Layout: sidebar | (tabs / editor). Height comes from the component's
   \`height\` prop set inline on .os-body, so it must NOT flex-grow (a
   flex-basis of 0 would override that height and collapse to nothing). */
.os-body { display: flex; min-height: 0; position: relative; }
.os-sidebar {
  flex: 0 0 auto;
  width: 200px;
  overflow-y: auto;
  background: var(--os-bg);
  border-right: 1px solid var(--os-border);
  padding: 6px 0;
}
.os-sidebar-title {
  padding: 6px 12px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--os-muted);
}
.os-main { display: flex; flex-direction: column; flex: 1; min-width: 0; }
.os-editor { flex: 1; min-height: 0; position: relative; }

/* File tree */
.os-tree { font-size: 13px; }
.os-tree-row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 3px 12px;
  cursor: pointer;
  color: var(--os-text);
  white-space: nowrap;
  overflow: hidden;
}
.os-tree-row:hover { background: color-mix(in srgb, var(--os-accent) 14%, transparent); }
.os-tree-row[data-active='true'] {
  background: color-mix(in srgb, var(--os-accent) 22%, transparent);
  font-weight: 600;
}
.os-tree-row svg { flex: 0 0 auto; opacity: 0.75; }
.os-tree-name { overflow: hidden; text-overflow: ellipsis; }

/* Tabs */
.os-tabs {
  display: flex;
  align-items: stretch;
  overflow-x: auto;
  background: var(--os-surface);
  border-bottom: 1px solid var(--os-border);
}
.os-tab {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-right: 1px solid var(--os-border);
  cursor: pointer;
  white-space: nowrap;
  color: var(--os-muted);
}
.os-tab[data-active='true'] {
  color: var(--os-text);
  box-shadow: inset 0 -2px 0 0 var(--os-accent);
}
.os-tab:hover { color: var(--os-text); }

/* Control bar */
.os-controls {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 9px 12px;
  background: var(--os-bg);
  border-top: 1px solid var(--os-border);
  user-select: none;
}
.os-btn {
  all: unset;
  box-sizing: border-box;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-width: 30px;
  height: 30px;
  padding: 0 10px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  color: var(--os-text);
  transition: background 120ms ease, transform 120ms ease, opacity 120ms ease;
}
.os-btn:hover { background: color-mix(in srgb, var(--os-muted) 22%, transparent); }
.os-btn:active { transform: scale(0.94); }
.os-btn-primary { background: var(--os-accent); color: var(--os-accent-contrast); }
.os-btn-primary:hover { background: color-mix(in srgb, var(--os-accent) 88%, #000); }
.os-btn-round { width: 34px; height: 34px; min-width: 34px; padding: 0; border-radius: 999px; }
.os-btn[disabled] { opacity: 0.4; cursor: default; transform: none; }
.os-time {
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  color: var(--os-muted);
  font-size: 12px;
}

/* Scrubber — the browser default range is the ugliest part, so fully restyle. */
.os-seek-wrap { position: relative; flex: 1; min-width: 40px; display: flex; align-items: center; }
.os-seek {
  -webkit-appearance: none;
  appearance: none;
  width: 100%;
  height: 4px;
  border-radius: 999px;
  background: var(--os-border);
  cursor: pointer;
  outline: none;
}
.os-seek::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 13px;
  height: 13px;
  border-radius: 50%;
  background: var(--os-accent);
  border: 2px solid var(--os-surface);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
  cursor: pointer;
}
.os-seek::-moz-range-thumb {
  width: 13px;
  height: 13px;
  border: 2px solid var(--os-surface);
  border-radius: 50%;
  background: var(--os-accent);
  cursor: pointer;
}
.os-fork-marker {
  position: absolute;
  top: 50%;
  width: 10px;
  height: 10px;
  margin-left: -5px;
  transform: translateY(-50%);
  border-radius: 50%;
  background: var(--os-accent);
  border: 1px solid var(--os-surface);
  cursor: pointer;
}
.os-select {
  background: transparent;
  color: var(--os-text);
  border: 1px solid var(--os-border);
  border-radius: 6px;
  padding: 3px 6px;
  font-size: 12px;
  cursor: pointer;
}
.os-select:hover { border-color: var(--os-muted); }
.os-select option { color: #000; }
.os-hint { color: var(--os-muted); font-size: 12px; }

/* Pointer overlay */
.os-pointer {
  position: absolute;
  width: 12px;
  height: 12px;
  margin: -6px 0 0 -6px;
  border-radius: 50%;
  background: color-mix(in srgb, var(--os-accent) 85%, transparent);
  box-shadow: 0 0 8px color-mix(in srgb, var(--os-accent) 60%, transparent);
  pointer-events: none;
  z-index: 10;
  transition: left 80ms linear, top 80ms linear;
}

.os-error {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 120px;
  padding: 16px;
  text-align: center;
  color: #e06c75;
  font-size: 13px;
}
`;

/**
 * Ensures the component stylesheet is present and up to date. Idempotent in
 * production; in dev it re-syncs the CSS content so an older injected sheet
 * (kept across HMR) can't shadow updated styles.
 */
export function injectStyles(doc: Document): void {
  let style = doc.getElementById(STYLE_ID) as HTMLStyleElement | null;
  if (!style) {
    style = doc.createElement('style');
    style.id = STYLE_ID;
    doc.head.appendChild(style);
  }
  if (style.textContent !== OPENSCRIM_CSS) style.textContent = OPENSCRIM_CSS;
}
