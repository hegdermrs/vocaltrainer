import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function getWebhookUrl(): string {
  return process.env.N8N_ANALYZE_WEBHOOK_URL || process.env.NEXT_PUBLIC_N8N_ANALYZE_WEBHOOK_URL || '';
}

function buildUpstreamFormData(source: FormData): FormData {
  const target = new FormData();

  for (const [key, value] of Array.from(source.entries())) {
    if (value instanceof File) {
      target.append(key, value, value.name);
    } else {
      target.append(key, value);
    }
  }

  return target;
}

export async function POST(request: Request) {
  try {
    const webhookUrl = getWebhookUrl();
    if (!webhookUrl) {
      return NextResponse.json(
        { error: 'N8N_ANALYZE_WEBHOOK_URL is not configured.' },
        { status: 500 }
      );
    }

    const incomingFormData = await request.formData();
    const upstreamFormData = buildUpstreamFormData(incomingFormData);

    const upstreamResponse = await fetch(webhookUrl, {
      method: 'POST',
      body: upstreamFormData
    });

    const responseText = await upstreamResponse.text();
    const contentType = upstreamResponse.headers.get('content-type') || 'application/json';

    return new Response(responseText, {
      status: upstreamResponse.status,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'no-store'
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'AI analysis proxy failed.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
