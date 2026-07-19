import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { connectToDatabase } from '@/lib/mongodb';
import { findOneRecording, getAllEvents } from '@/lib/recordingsService';
import { writeTantricaBuffer } from '@thisisayande/openscrim-core';
import type { TantricaFile } from '@thisisayande/openscrim-core';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?._id) {
    return NextResponse.json(
      { status: 401, code: 'UNAUTHORIZED', message: 'Not authenticated' },
      { status: 401 }
    );
  }

  await connectToDatabase();

  try {
    const { id } = await params;
    const recording = await findOneRecording(id, session.user._id);
    const events = await getAllEvents(id);

    const file: TantricaFile = {
      version: 1,
      metadata: {
        id: recording._id.toString(),
        title: recording.title,
        description: recording.description ?? undefined,
        author: {
          id: recording.userId.toString(),
          name: '',
        },
        language: recording.language,
        duration: recording.duration,
        eventCount: recording.eventCount,
        createdAt: recording.createdAt.toISOString(),
        tags: recording.tags,
      },
      initialContent: recording.initialContent,
      finalContent: recording.finalContent,
      editorConfig: recording.editorConfig ?? {
        fontSize: 14,
        tabSize: 2,
        theme: 'vs-dark',
        wordWrap: true,
      },
      events: events as unknown as TantricaFile['events'],
    };

    const tantricaFile = writeTantricaBuffer(file);
    const filename = recording.title.replace(/[^a-zA-Z0-9]/g, '_');

    return new Response(new Uint8Array(tantricaFile), {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${filename}.tantrica"`,
        'Content-Length': tantricaFile.length.toString(),
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    const status = msg === 'Recording not found' ? 404 : 403;
    return NextResponse.json(
      { status, code: 'ERROR', message: msg },
      { status }
    );
  }
}
