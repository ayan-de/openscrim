'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import PlaybackViewer from '@/components/viewer/PlaybackViewer';
import {
  fetchRecording,
  fetchRecordingEvents,
  incrementPlayCount,
  convertApiRecordingToSession,
} from '@/lib/recordingsApi';
import type { RecordingSession } from '@thisisayande/openscrim-core';

export default function RecordingPlayerPage() {
  const params = useParams();
  const id = params.id as string;
  const [session, setSession] = useState<RecordingSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;

    Promise.all([fetchRecording(id), fetchRecordingEvents(id)])
      .then(([recording, events]) => {
        setSession(
          convertApiRecordingToSession(recording, events) as RecordingSession
        );
        incrementPlayCount(id).catch(() => {});
      })
      .catch((err) => {
        setError(err.message || 'Failed to load recording');
      })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="fixed inset-0 bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4" />
          <p className="text-gray-400">Loading recording...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0 bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-white mb-2">
            Failed to load recording
          </h2>
          <p className="text-gray-400">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-gray-900">
      <PlaybackViewer session={session} />
    </div>
  );
}
