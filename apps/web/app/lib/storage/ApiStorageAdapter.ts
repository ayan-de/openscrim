import type { RecordingSession, RecordingEvent } from '@thisisayande/openscrim-core';
import type { RecordingStorage, RecordingListResult } from './types';
import {
  fetchRecordings,
  fetchRecording,
  fetchRecordingEvents,
  createRecording,
  deleteRecording as deleteRecordingApi,
  convertApiRecordingToSession,
} from '@/lib/recordingsApi';

export class ApiStorageAdapter implements RecordingStorage {
  async save(session: RecordingSession): Promise<void> {
    await createRecording({
      title: session.title,
      description: session.description,
      language: session.language,
      duration: session.duration,
      eventCount: session.events.length,
      initialContent: session.initialContent,
      finalContent: session.finalContent,
      events: session.events as unknown as Record<string, unknown>[],
    });
  }

  async load(id: string): Promise<RecordingSession | null> {
    try {
      const [recording, events] = await Promise.all([
        fetchRecording(id),
        fetchRecordingEvents(id),
      ]);
      return convertApiRecordingToSession(
        recording,
        events
      ) as RecordingSession;
    } catch {
      return null;
    }
  }

  async list(page = 1, limit = 20): Promise<RecordingListResult> {
    const result = await fetchRecordings(page, limit);
    const recordings = result.recordings.map((r) =>
      convertApiRecordingToSession(r, [])
    ) as RecordingSession[];
    return { recordings, total: result.total };
  }

  async delete(id: string): Promise<void> {
    await deleteRecordingApi(id);
  }

  async getEvents(id: string): Promise<RecordingEvent[]> {
    const events = await fetchRecordingEvents(id);
    return events as RecordingEvent[];
  }
}
