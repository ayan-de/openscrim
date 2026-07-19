'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { FaClock, FaBolt, FaCode, FaCalendar } from 'react-icons/fa';
import { HiOutlineDownload } from 'react-icons/hi';
import PlaybackViewer from '../../components/viewer/PlaybackViewer';
import { useLoading } from '@/context/LoadingContext';
import { useAuth } from '@/hooks/useAuth';
import { getRecordingStorage } from '@/lib/storage';
import { formatDuration } from '@/lib/formatDuration';
import { downloadRecording } from '@/lib/recordingsApi';
import type { RecordingSession } from '@thisisayande/openscrim-core';
import { sessionToTantricaFile } from '@thisisayande/openscrim-core';

export default function ViewPage() {
  const { showError } = useLoading();
  const { isAuthenticated } = useAuth();
  const [recordings, setRecordings] = useState<RecordingSession[]>([]);
  const [selectedSession, setSelectedSession] =
    useState<RecordingSession | null>(null);
  const [loading, setLoading] = useState(true);

  const loadRecordings = useCallback(() => {
    setLoading(true);
    const storage = getRecordingStorage(() => isAuthenticated);
    storage
      .list(1, 50)
      .then((result) => {
        setRecordings(result.recordings);
      })
      .catch((err) => {
        console.error('Error loading recordings:', err);
      })
      .finally(() => setLoading(false));
  }, [isAuthenticated]);

  useEffect(() => {
    loadRecordings();
  }, [loadRecordings]);

  const handleRecordingSelect = async (recording: RecordingSession) => {
    try {
      const storage = getRecordingStorage(() => isAuthenticated);
      const events = await storage.getEvents(recording.id);
      setSelectedSession({ ...recording, events });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to load recording events';
      showError(message);
    }
  };

  const handleClosePlayback = () => {
    setSelectedSession(null);
  };

  const handleDelete = async (recordingId: string) => {
    if (!confirm('Are you sure you want to delete this recording?')) return;
    try {
      const storage = getRecordingStorage(() => isAuthenticated);
      await storage.delete(recordingId);
      setRecordings((prev) => prev.filter((r) => r.id !== recordingId));
      if (selectedSession?.id === recordingId) {
        setSelectedSession(null);
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to delete recording';
      console.error('Error deleting recording:', err);
      showError(message);
    }
  };

  const handleDownload = async (
    e: React.MouseEvent,
    recording: RecordingSession
  ) => {
    e.stopPropagation();
    try {
      const filename = `${recording.title || 'recording'}.tantrica`;
      if (isAuthenticated) {
        await downloadRecording(recording.id, filename);
        return;
      }
      const storage = getRecordingStorage(() => isAuthenticated);
      const events = await storage.getEvents(recording.id);
      const session = { ...recording, events };
      const file = sessionToTantricaFile(session);
      const jsonStr = JSON.stringify(file);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to download recording';
      showError(message);
    }
  };

  if (selectedSession) {
    return (
      <div className="fixed inset-0 bg-background z-50">
        <PlaybackViewer
          session={selectedSession}
          onClose={handleClosePlayback}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-card rounded-xl shadow-lg border border-border">
        <div className="p-6 border-b border-border bg-primary/5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-card-foreground mb-2">
                Saved Recordings ({recordings.length})
              </h2>
              <p className="text-muted-foreground text-sm">
                Click on any recording to start playback with full interactive
                controls
              </p>
            </div>
            {loading && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                <span className="text-sm">Loading...</span>
              </div>
            )}
          </div>
        </div>

        <div className="p-6">
          {recordings.length === 0 && !loading ? (
            <div className="text-center py-16">
              <h3 className="text-2xl font-medium text-card-foreground mb-3">
                No recordings yet
              </h3>
              <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                Create your first recording to see it here. All recordings are
                automatically saved and ready for playback.
              </p>
              <Link
                href="/record"
                className="bg-primary hover:bg-primary/90 text-primary-foreground px-8 py-3 rounded-lg font-medium transition-colors inline-flex items-center gap-2"
              >
                Start Your First Recording
              </Link>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {recordings.map((recording) => (
                <div
                  key={recording.id}
                  className="group border border-border rounded-xl p-6 hover:shadow-lg hover:border-primary/50 transition-all duration-200 cursor-pointer bg-card"
                  onClick={() => handleRecordingSelect(recording)}
                >
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="font-semibold text-card-foreground text-lg group-hover:text-primary transition-colors truncate pr-2">
                      {recording.title}
                    </h3>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(recording.id);
                      }}
                      className="text-destructive hover:text-destructive/80 transition-colors p-1 rounded opacity-0 group-hover:opacity-100"
                      title="Delete recording"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </button>
                    <button
                      onClick={(e) => handleDownload(e, recording)}
                      className="text-muted-foreground hover:text-primary transition-colors p-1 rounded opacity-0 group-hover:opacity-100"
                      title="Download recording"
                    >
                      <HiOutlineDownload className="w-4 h-4" />
                    </button>
                  </div>

                  {recording.description && (
                    <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                      {recording.description}
                    </p>
                  )}

                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="flex items-center gap-2">
                        <FaClock className="text-primary" />
                        <div>
                          <div className="font-medium text-card-foreground">
                            {formatDuration(recording.duration, 'short')}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Duration
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <FaBolt className="text-primary" />
                        <div>
                          <div className="font-medium text-card-foreground">
                            {recording.events?.length ?? 0}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Events
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="flex items-center gap-2">
                        <FaCode className="text-primary" />
                        <div>
                          <div className="font-medium text-card-foreground">
                            {recording.language}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Language
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <FaCalendar className="text-primary" />
                        <div>
                          <div className="font-medium text-card-foreground">
                            {recording.createdAt
                              ? new Date(
                                  recording.createdAt
                                ).toLocaleDateString()
                              : '--'}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Created
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 pt-4 border-t border-border">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground group-hover:text-primary transition-colors">
                        Click to play recording
                      </span>
                      <div className="text-2xl text-primary group-hover:scale-110 transition-transform">
                        &#9654;
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {recordings.length > 0 && (
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-6">
          <h3 className="font-semibold text-card-foreground mb-4 flex items-center gap-2 text-lg">
            Playback Features
          </h3>
          <div className="grid md:grid-cols-2 gap-6 text-sm text-muted-foreground">
            <div>
              <h4 className="font-medium mb-2 text-card-foreground">
                Interactive Controls
              </h4>
              <ul className="space-y-1">
                <li>- Play, pause, and stop playback at any time</li>
                <li>- Adjustable speed from 0.25x to 4x</li>
                <li>- Timeline scrubber for instant navigation</li>
                <li>- Real-time progress indicators</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-2 text-card-foreground">
                Viewing Experience
              </h4>
              <ul className="space-y-1">
                <li>- Watch code appear exactly as typed</li>
                <li>- See cursor movements and selections</li>
                <li>- Perfect timing reproduction</li>
                <li>- Syntax highlighting preserved</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
