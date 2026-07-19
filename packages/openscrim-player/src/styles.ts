const STYLE_ID = 'openscrim-player-styles';

export const PLAYER_CSS = `
.osp-root {
  display: flex;
  flex-direction: column;
  position: relative;
  overflow: hidden;
  border-radius: 8px;
  border: 1px solid #2a2a2a;
  background: #1e1e1e;
  font-family: ui-sans-serif, system-ui, -apple-system, sans-serif;
}
.osp-root[data-theme='light'] {
  border-color: #ddd;
  background: #fffffe;
}
.osp-editor {
  flex: 1;
  min-height: 0;
  position: relative;
}
.osp-pointer {
  position: absolute;
  width: 12px;
  height: 12px;
  margin: -6px 0 0 -6px;
  border-radius: 50%;
  background: rgba(255, 200, 0, 0.85);
  box-shadow: 0 0 8px rgba(255, 200, 0, 0.6);
  pointer-events: none;
  z-index: 10;
  transition: left 80ms linear, top 80ms linear;
  display: none;
}
.osp-controls {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  background: #161616;
  color: #ccc;
  font-size: 13px;
  user-select: none;
}
.osp-root[data-theme='light'] .osp-controls {
  background: #f3f3f3;
  color: #333;
}
.osp-btn {
  all: unset;
  cursor: pointer;
  width: 30px;
  height: 30px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  font-size: 14px;
  line-height: 1;
}
.osp-btn:hover { background: rgba(128, 128, 128, 0.2); }
.osp-seek {
  flex: 1;
  accent-color: #f5a623;
  cursor: pointer;
}
.osp-time {
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.osp-speed {
  background: transparent;
  color: inherit;
  border: 1px solid rgba(128, 128, 128, 0.4);
  border-radius: 6px;
  padding: 2px 4px;
  font-size: 12px;
  cursor: pointer;
}
.osp-speed option { color: #000; }
.osp-hint {
  position: absolute;
  top: 10px;
  right: 12px;
  z-index: 11;
  background: rgba(245, 166, 35, 0.95);
  color: #1a1a1a;
  font-size: 12px;
  font-weight: 600;
  padding: 4px 10px;
  border-radius: 999px;
  display: none;
}
.osp-error {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  min-height: 120px;
  color: #e66;
  font-size: 13px;
  padding: 16px;
  text-align: center;
}
`;

export function injectStyles(doc: Document): void {
  if (doc.getElementById(STYLE_ID)) return;
  const style = doc.createElement('style');
  style.id = STYLE_ID;
  style.textContent = PLAYER_CSS;
  doc.head.appendChild(style);
}
