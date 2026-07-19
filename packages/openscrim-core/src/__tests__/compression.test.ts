import { describe, expect, it } from 'vitest';
import { compressEvents, decompressEvents } from '../compression.js';
import {
  contentChange,
  cursor,
  keystroke,
  pointer,
  scroll,
} from './helpers.js';

describe('compressEvents', () => {
  it('returns empty for empty input', () => {
    expect(compressEvents([])).toEqual([]);
  });

  it('collapses a cursor burst within the dedup window to the last position', () => {
    const events = [cursor(0, 1), cursor(10, 2), cursor(20, 3)];
    const result = compressEvents(events);

    expect(result).toEqual([events[2]]);
  });

  it('keeps cursor events that are further apart than the window', () => {
    const events = [cursor(0, 1), cursor(100, 2), cursor(200, 3)];

    expect(compressEvents(events)).toEqual(events);
  });

  it('collapses scroll and pointer-move bursts to the last event', () => {
    const events = [
      scroll(0, 10),
      scroll(10, 20),
      pointer(30, 'move'),
      pointer(40, 'move'),
    ];
    const result = compressEvents(events);

    expect(result).toEqual([events[1], events[3]]);
  });

  it('does not collapse pointer clicks', () => {
    const events = [pointer(0, 'click'), pointer(5, 'click')];

    expect(compressEvents(events)).toEqual(events);
  });

  it('keeps every keystroke', () => {
    const events = [keystroke(0, 'a'), keystroke(5, 'b'), keystroke(10, 'c')];

    expect(compressEvents(events)).toEqual(events);
  });

  it('never drops content_change deltas, even in rapid bursts', () => {
    // Deltas are not snapshots: dropping any of them corrupts the replayed
    // document. "abc" typed within 50ms must survive as three deltas.
    const events = [
      contentChange(0, 'a'),
      contentChange(5, 'b'),
      contentChange(10, 'c'),
    ];

    expect(compressEvents(events)).toEqual(events);
  });

  it('preserves relative order across mixed event types', () => {
    const events = [
      keystroke(0, 'x'),
      contentChange(1, 'x'),
      cursor(2, 2),
      keystroke(30, 'y'),
      contentChange(31, 'y'),
      cursor(32, 3),
    ];
    const result = compressEvents(events);

    expect(result.map((e) => e.type)).toEqual([
      'keystroke',
      'content_change',
      'cursor_position',
      'keystroke',
      'content_change',
      'cursor_position',
    ]);
  });
});

describe('decompressEvents', () => {
  it('returns events unchanged', () => {
    const events = [keystroke(0), contentChange(1, 'a'), cursor(2)];

    expect(decompressEvents(events)).toEqual(events);
  });
});
