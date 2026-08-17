'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { useLoading } from '@/context/LoadingContext';
import {
  fetchRecordings,
  deleteRecording as deleteRecordingApi,
  updateRecording,
  type RecordingFromApi,
} from '@/lib/recordingsApi';
import { formatDuration } from '@/lib/formatDuration';

export default function DashboardPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { showSuccess, showError } = useLoading();
  const [recordings, setRecordings] = useState<RecordingFromApi[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (!isAuthenticated && !authLoading) {
      return;
    }
    if (!isAuthenticated) return;

    setLoading(true);
    fetchRecordings(page)
      .then((data) => {
        setRecordings(data.recordings);
        setTotal(data.total);
      })
      .catch((err) => {
        console.error('Error loading recordings:', err);
      })
      .finally(() => setLoading(false));
  }, [isAuthenticated, authLoading, page]);

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this recording?')) return;
    try {
      await deleteRecordingApi(id);
      setRecordings((prev) => prev.filter((r) => r._id !== id));
      setTotal((prev) => prev - 1);
      showSuccess('Recording deleted');
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to delete recording';
      showError(message);
    }
  };

  const handleTogglePublic = async (recording: RecordingFromApi) => {
    try {
      await updateRecording(recording._id, {
        isPublic: !recording.isPublic,
      });
      setRecordings((prev) =>
        prev.map((r) =>
          r._id === recording._id ? { ...r, isPublic: !r.isPublic } : r
        )
      );
      showSuccess(
        recording.isPublic
          ? 'Recording set to private'
          : 'Recording set to public'
      );
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to update recording';
      showError(message);
    }
  };

  if (authLoading) {
    return (
      <div className="flex-grow flex items-center justify-center px-4 py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex-grow flex items-center justify-center px-4 py-20">
        <div className="text-center">
          <h2 className="text-2xl font-semibold text-foreground mb-4">
            Sign in to view your dashboard
          </h2>
          <Link
            href="/"
            className="bg-primary text-primary-foreground px-6 py-3 rounded-lg font-medium hover:bg-primary/90 transition-colors"
          >
            Go Home
          </Link>
        </div>
      </div>
    );
  }

  const totalPages = Math.ceil(total / 20);

  return (
    <div className="flex-grow px-4 md:px-6 py-8 max-w-6xl mx-auto w-full">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            {total} recording{total !== 1 ? 's' : ''}
          </p>
        </div>
        <Link
          href="/upload"
          className="bg-primary text-primary-foreground px-6 py-3 rounded-lg font-medium hover:bg-primary/90 transition-colors"
        >
          Upload .scrim
        </Link>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : recordings.length === 0 ? (
        <div className="text-center py-20">
          <h3 className="text-xl font-medium text-foreground mb-4">
            No recordings yet
          </h3>
          <p className="text-muted-foreground mb-6">
            Record a session or upload a .scrim file to get started.
          </p>
          <div className="flex gap-4 justify-center">
            <Link
              href="/record"
              className="bg-primary text-primary-foreground px-6 py-3 rounded-lg font-medium hover:bg-primary/90 transition-colors"
            >
              Start Recording
            </Link>
            <Link
              href="/upload"
              className="border border-border text-foreground px-6 py-3 rounded-lg font-medium hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              Upload File
            </Link>
          </div>
        </div>
      ) : (
        <>
          <div className="grid gap-4">
            {recordings.map((recording) => (
              <div
                key={recording._id}
                className="bg-card backdrop-blur-sm border border-border rounded-lg p-5 flex items-center justify-between"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="text-lg font-semibold text-card-foreground truncate">
                      {recording.title}
                    </h3>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${recording.isPublic ? 'bg-green-500/20 text-green-700 dark:text-green-300' : 'bg-muted text-muted-foreground'}`}
                    >
                      {recording.isPublic ? 'Public' : 'Private'}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span>{recording.language}</span>
                    <span>{formatDuration(recording.duration, 'short')}</span>
                    <span>{recording.eventCount} events</span>
                    <span>{recording.playCount} plays</span>
                    <span>
                      {new Date(recording.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 ml-4">
                  <Link
                    href={`/r/${recording._id}`}
                    className="px-3 py-1.5 bg-primary text-primary-foreground hover:bg-primary/90 text-sm rounded transition-colors"
                  >
                    Play
                  </Link>
                  <button
                    onClick={() => handleTogglePublic(recording)}
                    className="px-3 py-1.5 bg-muted hover:bg-muted/80 text-foreground text-sm rounded transition-colors"
                  >
                    {recording.isPublic ? 'Make Private' : 'Make Public'}
                  </button>
                  <button
                    onClick={() => handleDelete(recording._id)}
                    className="px-3 py-1.5 bg-destructive/20 hover:bg-destructive/40 text-destructive text-sm rounded transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-8">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-4 py-2 bg-muted text-foreground rounded disabled:opacity-50"
              >
                Prev
              </button>
              <span className="text-muted-foreground">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-4 py-2 bg-muted text-foreground rounded disabled:opacity-50"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
