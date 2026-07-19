import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { connectToDatabase } from '@/lib/mongodb';
import { createRecording } from '@/lib/recordingsService';
import { readTantricaBuffer } from '@thisisayande/openscrim-core';
import type { TantricaFile } from '@thisisayande/openscrim-core';

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?._id) {
    return NextResponse.json(
      { status: 401, code: 'UNAUTHORIZED', message: 'Not authenticated' },
      { status: 401 }
    );
  }

  await connectToDatabase();

  const formData = await request.formData();
  const file = formData.get('file');
  if (!file || !(file instanceof File)) {
    return NextResponse.json(
      { status: 400, code: 'BAD_REQUEST', message: 'No file uploaded' },
      { status: 400 }
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  let parsed: TantricaFile;
  try {
    parsed = readTantricaBuffer(buffer);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json(
      {
        status: 400,
        code: 'BAD_REQUEST',
        message: `Failed to parse file: ${msg}`,
      },
      { status: 400 }
    );
  }

  const dto = {
    title: parsed.metadata?.title ?? file.name,
    description: parsed.metadata?.description,
    language: parsed.metadata?.language ?? 'javascript',
    duration: parsed.metadata?.duration ?? 0,
    eventCount: parsed.metadata?.eventCount ?? 0,
    initialContent: parsed.initialContent ?? '',
    finalContent: parsed.finalContent ?? '',
    editorConfig: parsed.editorConfig ?? {
      fontSize: 14,
      tabSize: 2,
      theme: 'vs-dark',
      wordWrap: true,
    },
    tags: parsed.metadata?.tags ?? [],
    isPublic: false,
    events: (parsed.events ?? []) as unknown as Record<string, unknown>[],
  };

  const recording = await createRecording(session.user._id, dto);
  return NextResponse.json(
    {
      status: 201,
      code: 'CREATED',
      message: 'Recording uploaded successfully',
      data: recording,
    },
    { status: 201 }
  );
}
