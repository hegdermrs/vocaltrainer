import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdminClient, getSupabaseStorageBucket } from '@/src/server/supabaseStorage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const requestSchema = z.object({
  sessionId: z.number(),
  mimeType: z.string().min(1)
});

function extensionFromMimeType(mimeType: string): string {
  if (mimeType.includes('mp4')) return 'm4a';
  if (mimeType.includes('mpeg')) return 'mp3';
  if (mimeType.includes('ogg')) return 'ogg';
  return 'webm';
}

export async function POST(request: Request) {
  try {
    const body = requestSchema.parse(await request.json());
    const bucket = getSupabaseStorageBucket();
    const path = `practice-sessions/${body.sessionId}/${Date.now()}.${extensionFromMimeType(body.mimeType)}`;

    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase.storage.from(bucket).createSignedUploadUrl(path);
    if (error || !data?.token) {
      throw new Error(error?.message || 'Could not create a signed upload URL.');
    }

    return NextResponse.json({
      bucket,
      path,
      token: data.token
    });
  } catch (error) {
    const message = error instanceof z.ZodError
      ? `Invalid upload request: ${error.issues[0]?.message ?? 'unknown schema error'}`
      : error instanceof Error
        ? error.message
        : 'Could not prepare audio upload.';

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
