import { NextResponse } from 'next/server';
import { syncThinkificVideoCatalog } from '@/src/server/thinkificCatalog';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const result = await syncThinkificVideoCatalog();
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Thinkific sync failed.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
