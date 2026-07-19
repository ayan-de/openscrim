import type { RecordingEvent } from './types.js';

const CURSOR_DEDUP_WINDOW_MS = 50;
const KEYSTROKE_BATCH_WINDOW_MS = 16;

export function compressEvents(events: RecordingEvent[]): RecordingEvent[] {
  if (events.length === 0) return [];

  const result: RecordingEvent[] = [];
  let i = 0;

  while (i < events.length) {
    const event = events[i]!;

    if (event.type === 'cursor_position') {
      const batch = takeWhile(
        events,
        i,
        (e) => e.type === 'cursor_position',
        CURSOR_DEDUP_WINDOW_MS
      );
      result.push(batch[batch.length - 1]!);
      i += batch.length;
      continue;
    }

    if (event.type === 'pointer' && event.kind === 'move') {
      const batch = takeWhile(
        events,
        i,
        (e) => e.type === 'pointer' && e.kind === 'move',
        CURSOR_DEDUP_WINDOW_MS
      );
      result.push(batch[batch.length - 1]!);
      i += batch.length;
      continue;
    }

    if (event.type === 'scroll') {
      const batch = takeWhile(
        events,
        i,
        (e) => e.type === 'scroll',
        CURSOR_DEDUP_WINDOW_MS
      );
      result.push(batch[batch.length - 1]!);
      i += batch.length;
      continue;
    }

    if (event.type === 'keystroke') {
      const batch = takeWhile(
        events,
        i,
        (e) => e.type === 'keystroke',
        KEYSTROKE_BATCH_WINDOW_MS
      );
      if (batch.length === 1) {
        result.push(batch[0]!);
      } else {
        result.push(...batch);
      }
      i += batch.length;
      continue;
    }

    // content_change events are deltas, not snapshots — every one must be
    // kept or the replayed document diverges from what was typed.
    result.push(event);
    i++;
  }

  return result;
}

export function decompressEvents(events: RecordingEvent[]): RecordingEvent[] {
  return events;
}

function takeWhile(
  events: RecordingEvent[],
  startIndex: number,
  predicate: (e: RecordingEvent) => boolean,
  windowMs: number
): RecordingEvent[] {
  const result: RecordingEvent[] = [];
  const startTime = events[startIndex]!.timestamp;
  let i = startIndex;

  while (i < events.length) {
    const event = events[i]!;
    if (event.timestamp - startTime > windowMs) break;
    if (!predicate(event)) break;
    result.push(event);
    i++;
  }

  return result;
}
