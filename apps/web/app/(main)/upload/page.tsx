'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useLoading } from '@/context/LoadingContext';
import { uploadScrimFile } from '@/lib/recordingsApi';
import Link from 'next/link';

export default function UploadPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { showSuccess, showError, showLoading } = useLoading();
  const router = useRouter();
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (file: File) => {
    if (!file.name.endsWith('.scrim') && !file.name.endsWith('.json')) {
      showError('Please upload a .scrim or .json file');
      return;
    }

    showLoading('Uploading recording...');
    try {
      const recording = await uploadScrimFile(file);
      showSuccess('Recording uploaded successfully!');
      router.push(`/r/${recording._id}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Upload failed';
      showError(message);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files[0];
    if (file) handleUpload(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleUpload(file);
  };

  if (authLoading) {
    return (
      <div className="flex-grow flex items-center justify-center px-4 py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex-grow flex items-center justify-center px-4 py-20">
        <div className="text-center">
          <h2 className="text-2xl font-semibold text-white mb-4">
            Sign in to upload recordings
          </h2>
          <Link
            href="/"
            className="bg-white text-black px-6 py-3 rounded-lg font-medium hover:bg-gray-100 transition-colors"
          >
            Go Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-grow px-4 md:px-6 py-8 max-w-2xl mx-auto w-full">
      <h1 className="text-3xl font-bold text-white mb-8">Upload Recording</h1>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-16 text-center cursor-pointer transition-colors ${
          dragActive
            ? 'border-blue-400 bg-blue-500/10'
            : 'border-white/30 hover:border-white/50 hover:bg-white/5'
        }`}
      >
        <div className="text-4xl mb-4">&#128228;</div>
        <h3 className="text-xl font-semibold text-white mb-2">
          Drop your .scrim file here
        </h3>
        <p className="text-white/60 mb-4">
          or click to browse. Accepts .scrim and .json files.
        </p>
        <span className="inline-block bg-white/10 text-white/80 px-4 py-2 rounded-lg text-sm">
          Choose File
        </span>
        <input
          ref={fileInputRef}
          type="file"
          accept=".scrim,.json"
          onChange={handleFileChange}
          className="hidden"
        />
      </div>

      <div className="mt-8 bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg p-6">
        <h3 className="font-semibold text-white mb-3">About .scrim files</h3>
        <p className="text-white/60 text-sm leading-relaxed">
          .scrim files are compressed recording files created by OpenScrim.
          They contain all editor events (keystrokes, cursor
          movements, content changes) needed to replay a coding session at
          exactly the same speed and quality as the original — with zero pixel
          fluctuation and extremely small file sizes.
        </p>
      </div>
    </div>
  );
}
