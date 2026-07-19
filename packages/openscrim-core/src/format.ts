import type { RecordingEvent, RecordingSession } from './types.js';

const FORMAT_VERSION = 1;

export interface TantricaFile {
  version: 1;
  metadata: {
    id: string;
    title: string;
    description?: string;
    author: { id: string; name: string };
    language: string;
    duration: number;
    eventCount: number;
    createdAt: string;
    tags?: string[];
  };
  initialContent: string;
  finalContent: string;
  /** Project snapshot at recording start (path → content) */
  files?: Record<string, string>;
  editorConfig: {
    fontSize: number;
    tabSize: number;
    theme: string;
    wordWrap: boolean;
  };
  events: RecordingEvent[];
}

export function sessionToTantricaFile(session: RecordingSession): TantricaFile {
  return {
    version: 1,
    metadata: {
      id: session.id,
      title: session.title,
      description: session.description,
      author: { id: '', name: '' },
      language: session.language,
      duration: session.duration,
      eventCount: session.events.length,
      createdAt: session.createdAt.toISOString(),
      tags: [],
    },
    initialContent: session.initialContent,
    finalContent: session.finalContent,
    files: session.files,
    editorConfig: {
      fontSize: session.metadata?.fontSize ?? 14,
      tabSize: session.metadata?.tabSize ?? 2,
      theme: session.metadata?.editorTheme ?? 'vs-dark',
      wordWrap: true,
    },
    events: session.events,
  };
}

export function tantricaFileToSession(file: TantricaFile): RecordingSession {
  return {
    id: file.metadata.id,
    title: file.metadata.title,
    description: file.metadata.description,
    language: file.metadata.language,
    initialContent: file.initialContent,
    finalContent: file.finalContent,
    duration: file.metadata.duration,
    events: file.events,
    files: file.files,
    createdAt: new Date(file.metadata.createdAt),
    updatedAt: new Date(file.metadata.createdAt),
    metadata: {
      editorTheme: file.editorConfig.theme,
      fontSize: file.editorConfig.fontSize,
      tabSize: file.editorConfig.tabSize,
    },
  };
}

export function writeTantricaBuffer(file: TantricaFile): Buffer {
  const jsonStr = JSON.stringify(file);
  const compressed = gzipSync(Buffer.from(jsonStr, 'utf-8'));

  const headerJson = JSON.stringify(file.metadata);
  const headerBuf = Buffer.from(headerJson, 'utf-8');

  const version = Buffer.alloc(2);
  version.writeUInt16BE(FORMAT_VERSION, 0);
  const headerLen = Buffer.alloc(4);
  headerLen.writeUInt32BE(headerBuf.length, 0);

  return Buffer.concat([
    Buffer.from('TNTC', 'ascii'),
    version,
    headerLen,
    headerBuf,
    compressed,
  ]);
}

export function readTantricaBuffer(buffer: Buffer): TantricaFile {
  if (
    buffer[0] !== 0x54 ||
    buffer[1] !== 0x4e ||
    buffer[2] !== 0x54 ||
    buffer[3] !== 0x43
  ) {
    return JSON.parse(buffer.toString('utf-8'));
  }

  const headerLength = buffer.readUInt32BE(6);
  const compressedData = buffer.slice(10 + headerLength);
  const decompressed = gunzipSync(compressedData);
  return JSON.parse(decompressed.toString('utf-8'));
}

/**
 * Parses a `.tantrica` payload (binary or plain JSON) using Web APIs only —
 * works in browsers and Node 18+, no Buffer/zlib required. Async because
 * browser gzip decompression (DecompressionStream) is stream-based.
 */
export async function parseTantricaBytes(
  bytes: Uint8Array
): Promise<TantricaFile> {
  if (
    bytes[0] !== 0x54 ||
    bytes[1] !== 0x4e ||
    bytes[2] !== 0x54 ||
    bytes[3] !== 0x43
  ) {
    return JSON.parse(new TextDecoder().decode(bytes));
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const headerLength = view.getUint32(6);
  const compressed = bytes.subarray(10 + headerLength);

  const stream = new Blob([compressed as BlobPart])
    .stream()
    .pipeThrough(new DecompressionStream('gzip'));
  const decompressed = await new Response(stream).arrayBuffer();
  return JSON.parse(new TextDecoder().decode(decompressed));
}

function gzipSync(data: Buffer): Buffer {
  const zlib = requireZlib();
  return zlib.gzipSync(data);
}

function gunzipSync(data: Buffer): Buffer {
  const zlib = requireZlib();
  return zlib.gunzipSync(data);
}

function requireZlib() {
  // Node >=20.16 (works in both ESM and CJS)
  if (
    typeof process !== 'undefined' &&
    typeof process.getBuiltinModule === 'function'
  ) {
    return process.getBuiltinModule('zlib');
  }
  if (typeof require !== 'undefined') {
    return require('zlib');
  }
  throw new Error('zlib not available in browser environment');
}
