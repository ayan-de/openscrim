import type { RecordingSession, RecordingEvent } from '@thisisayande/openscrim-core';
import type { RecordingStorage, RecordingListResult } from './types';
import {
  saveRecording,
  getRecording,
  getAllRecordings,
  deleteRecording as deleteRecordingDB,
} from '@/lib/recordingStorage';

export class IndexedDBStorageAdapter implements RecordingStorage {
  async save(session: RecordingSession): Promise<void> {
    await saveRecording(session);
  }

  async load(id: string): Promise<RecordingSession | null> {
    return getRecording(id);
  }

  async list(page = 1, limit = 20): Promise<RecordingListResult> {
    const all = await getAllRecordings();
    const total = all.length;
    const start = (page - 1) * limit;
    const recordings = all
      .slice(start, start + limit)
      .map((session) => ({ ...session, events: [] as RecordingEvent[] }));
    return { recordings, total };
  }

  async delete(id: string): Promise<void> {
    await deleteRecordingDB(id);
  }

  async getEvents(id: string): Promise<RecordingEvent[]> {
    const session = await getRecording(id);
    return session?.events ?? [];
  }
}
