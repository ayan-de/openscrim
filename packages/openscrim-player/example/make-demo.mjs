// Generates example/demo.tantrica — a synthetic session that "types out" a
// small program. Run from the repo root after building core:
//   node packages/openscrim-player/example/make-demo.mjs
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  sessionToTantricaFile,
  writeTantricaBuffer,
} from '@thisisayande/openscrim-core';

const code = `function greet(name) {
  return \`Hello, \${name}!\`;
}

console.log(greet('OpenScrim'));
`;

const events = [];
let line = 1;
let column = 1;
let timestamp = 0;

events.push({
  id: 'start',
  type: 'recording_start',
  timestamp,
  sessionId: 'demo',
});

for (const char of code) {
  timestamp += char === '\n' ? 260 : 70;
  events.push({
    id: `e${events.length}`,
    type: 'content_change',
    timestamp,
    sessionId: 'demo',
    changes: [
      {
        range: {
          startLineNumber: line,
          startColumn: column,
          endLineNumber: line,
          endColumn: column,
        },
        rangeLength: 0,
        text: char,
      },
    ],
    versionId: events.length,
    eol: '\n',
    isFlush: false,
    isRedoing: false,
    isUndoing: false,
  });
  events.push({
    id: `c${events.length}`,
    type: 'cursor_position',
    timestamp: timestamp + 1,
    sessionId: 'demo',
    position:
      char === '\n'
        ? { lineNumber: line + 1, column: 1 }
        : { lineNumber: line, column: column + 1 },
  });
  if (char === '\n') {
    line += 1;
    column = 1;
  } else {
    column += 1;
  }
}

timestamp += 500;
events.push({
  id: 'stop',
  type: 'recording_stop',
  timestamp,
  sessionId: 'demo',
});

const session = {
  id: 'demo',
  title: 'OpenScrim demo',
  description: 'Synthetic typing demo for the embed player',
  language: 'javascript',
  initialContent: '',
  finalContent: code,
  duration: timestamp,
  events,
  createdAt: new Date(),
  updatedAt: new Date(),
  metadata: { editorTheme: 'vs-dark', fontSize: 14, tabSize: 2 },
};

const outPath = join(
  dirname(fileURLToPath(import.meta.url)),
  'demo.tantrica'
);
writeFileSync(outPath, writeTantricaBuffer(sessionToTantricaFile(session)));
console.log(`Wrote ${outPath} (${events.length} events, ${timestamp}ms)`);
