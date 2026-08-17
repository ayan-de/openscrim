import { describe, expect, it } from 'vitest';
import {
  parseScrimBytes,
  readScrimBuffer,
  sessionToScrimFile,
  scrimFileToSession,
  writeScrimBuffer,
} from '../format.js';
import { makeSession } from './helpers.js';

describe('sessionToScrimFile / scrimFileToSession', () => {
  it('round-trips a session without losing data', () => {
    const session = makeSession();
    const file = sessionToScrimFile(session);
    const back = scrimFileToSession(file);

    expect(back.id).toBe(session.id);
    expect(back.title).toBe(session.title);
    expect(back.description).toBe(session.description);
    expect(back.language).toBe(session.language);
    expect(back.initialContent).toBe(session.initialContent);
    expect(back.finalContent).toBe(session.finalContent);
    expect(back.duration).toBe(session.duration);
    expect(back.events).toEqual(session.events);
    expect(back.files).toEqual(session.files);
    expect(back.createdAt.toISOString()).toBe(session.createdAt.toISOString());
    expect(back.metadata?.editorTheme).toBe('vs-dark');
    expect(back.metadata?.fontSize).toBe(14);
    expect(back.metadata?.tabSize).toBe(2);
  });

  it('records event count and version in metadata', () => {
    const session = makeSession();
    const file = sessionToScrimFile(session);

    expect(file.version).toBe(1);
    expect(file.metadata.eventCount).toBe(session.events.length);
    expect(file.metadata.createdAt).toBe('2026-01-02T03:04:05.678Z');
  });
});

describe('writeScrimBuffer / readScrimBuffer', () => {
  it('round-trips through the binary format', () => {
    const file = sessionToScrimFile(makeSession());
    const buffer = writeScrimBuffer(file);
    const back = readScrimBuffer(buffer);

    expect(back).toEqual(file);
  });

  it('starts with SCRM magic bytes and format version 1', () => {
    const buffer = writeScrimBuffer(sessionToScrimFile(makeSession()));

    expect(buffer.subarray(0, 4).toString('ascii')).toBe('SCRM');
    expect(buffer.readUInt16BE(4)).toBe(1);
  });

  it('exposes metadata in an uncompressed header readable without gunzip', () => {
    const file = sessionToScrimFile(makeSession());
    const buffer = writeScrimBuffer(file);

    const headerLength = buffer.readUInt32BE(6);
    const header = JSON.parse(
      buffer.subarray(10, 10 + headerLength).toString('utf-8')
    );

    expect(header).toEqual(file.metadata);
  });

  it('round-trips multi-byte unicode content', () => {
    const session = makeSession({
      title: 'émojis 🎬 and ✨',
      initialContent: 'console.log("héllo 🌍");\n',
      finalContent: 'console.log("héllo 🌍");\n// done ✅\n',
    });
    const file = sessionToScrimFile(session);
    const back = readScrimBuffer(writeScrimBuffer(file));

    expect(back).toEqual(file);
  });

  it('falls back to plain JSON when the buffer has no magic bytes', () => {
    const file = sessionToScrimFile(makeSession());
    const jsonBuffer = Buffer.from(JSON.stringify(file), 'utf-8');

    expect(readScrimBuffer(jsonBuffer)).toEqual(file);
  });

  it('parseScrimBytes reads the binary format without Buffer/zlib', async () => {
    const file = sessionToScrimFile(makeSession({ title: 'browser 🎬' }));
    const buffer = writeScrimBuffer(file);
    const bytes = new Uint8Array(buffer);

    expect(await parseScrimBytes(bytes)).toEqual(file);
  });

  it('parseScrimBytes falls back to plain JSON', async () => {
    const file = sessionToScrimFile(makeSession());
    const bytes = new TextEncoder().encode(JSON.stringify(file));

    expect(await parseScrimBytes(bytes)).toEqual(file);
  });

  it('parseScrimBytes handles byte views with a nonzero offset', async () => {
    const file = sessionToScrimFile(makeSession());
    const buffer = writeScrimBuffer(file);
    const padded = new Uint8Array(buffer.length + 8);
    padded.set(buffer, 8);
    const view = padded.subarray(8);

    expect(await parseScrimBytes(view)).toEqual(file);
  });

  it('round-trips an empty session', () => {
    const file = sessionToScrimFile(
      makeSession({
        events: [],
        files: undefined,
        description: undefined,
        initialContent: '',
        finalContent: '',
      })
    );
    const back = readScrimBuffer(writeScrimBuffer(file));

    expect(back).toEqual(file);
  });
});
