import type { RecordingSession, RecordingEvent } from '@thisisayande/openscrim-core';
import type { RecordingStorage, RecordingListResult } from './types';
import { IndexedDBStorageAdapter } from './IndexedDBStorageAdapter';
import { ApiStorageAdapter } from './ApiStorageAdapter';

export class SmartStorageAdapter implements RecordingStorage {
  private local: IndexedDBStorageAdapter;
  private api: ApiStorageAdapter;
  private getIsAuthenticated: () => boolean;

  constructor(getIsAuthenticated: () => boolean) {
    this.local = new IndexedDBStorageAdapter();
    this.api = new ApiStorageAdapter();
    this.getIsAuthenticated = getIsAuthenticated;
  }

  async save(session: RecordingSession): Promise<void> {
    await this.local.save(session);
    if (this.getIsAuthenticated()) {
      await this.api.save(session).catch((err) => {
        console.error('Failed to save recording to API:', err);
      });
    }
  }

  async load(id: string): Promise<RecordingSession | null> {
    if (this.getIsAuthenticated()) {
      const result = await this.api.load(id);
      if (result) return result;
    }
    return this.local.load(id);
  }

  async list(page?: number, limit?: number): Promise<RecordingListResult> {
    if (this.getIsAuthenticated()) {
      try {
        return await this.api.list(page, limit);
      } catch {
        // fall through to local
      }
    }
    return this.local.list(page, limit);
  }

  async delete(id: string): Promise<void> {
    if (this.getIsAuthenticated()) {
      await this.api.delete(id).catch((err) => {
        console.error('Failed to delete recording from API:', err);
      });
    }
    await this.local.delete(id);
  }

  async getEvents(id: string): Promise<RecordingEvent[]> {
    if (this.getIsAuthenticated()) {
      try {
        return await this.api.getEvents(id);
      } catch {
        // fall through to local
      }
    }
    return this.local.getEvents(id);
  }
}
