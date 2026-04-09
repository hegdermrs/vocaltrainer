'use client';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let browserClient: SupabaseClient | null = null;

export function getSupabaseBrowserBucket(): string {
  return process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET || 'practice-audio';
}

export function getSupabaseBrowserClient(): SupabaseClient {
  if (browserClient) return browserClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error('Supabase upload is not configured yet. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.');
  }

  browserClient = createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });

  return browserClient;
}
