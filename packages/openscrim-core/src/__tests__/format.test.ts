import { describe, expect, it } from 'vitest';
import {
  readTantricaBuffer,
  sessionToTantricaFile,
  tantricaFileToSession,
  writeTantricaBuffer,
} from '../format.js';
import { makeSession } from './helpers.js';

describe('sessionToTantricaFile / tantricaFileToSession', () => {
  it('round-trips a session without losing data', () => {
    const session = makeSession();
    const file = sessionToTantricaFile(session);
    const back = tantricaFileToSession(file);

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
    const file = sessionToTantricaFile(session);

    expect(file.version).toBe(1);
    expect(file.metadata.eventCount).toBe(session.events.length);
    expect(file.metadata.createdAt).toBe('2026-01-02T03:04:05.678Z');
  });
});

describe('writeTantricaBuffer / readTantricaBuffer', () => {
  it('round-trips through the binary format', () => {
    const file = sessionToTantricaFile(makeSession());
    const buffer = writeTantricaBuffer(file);
    const back = readTantricaBuffer(buffer);

    expect(back).toEqual(file);
  });

  it('starts with TNTC magic bytes and format version 1', () => {
    const buffer = writeTantricaBuffer(sessionToTantricaFile(makeSession()));

    expect(buffer.subarray(0, 4).toString('ascii')).toBe('TNTC');
    expect(buffer.readUInt16BE(4)).toBe(1);
  });

  it('exposes metadata in an uncompressed header readable without gunzip', () => {
    const file = sessionToTantricaFile(makeSession());
    const buffer = writeTantricaBuffer(file);

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
    const file = sessionToTantricaFile(session);
    const back = readTantricaBuffer(writeTantricaBuffer(file));

    expect(back).toEqual(file);
  });

  it('falls back to plain JSON when the buffer has no magic bytes', () => {
    const file = sessionToTantricaFile(makeSession());
    const jsonBuffer = Buffer.from(JSON.stringify(file), 'utf-8');

    expect(readTantricaBuffer(jsonBuffer)).toEqual(file);
  });

  it('round-trips an empty session', () => {
    const file = sessionToTantricaFile(
      makeSession({
        events: [],
        files: undefined,
        description: undefined,
        initialContent: '',
        finalContent: '',
      })
    );
    const back = readTantricaBuffer(writeTantricaBuffer(file));

    expect(back).toEqual(file);
  });
});
