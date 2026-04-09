import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let adminClient: SupabaseClient | null = null;

function getSupabaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  if (!url) {
    throw new Error('Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL.');
  }
  return url;
}

export function getSupabaseStorageBucket(): string {
  return process.env.SUPABASE_STORAGE_BUCKET || 'practice-audio';
}

export function getSupabaseAdminClient(): SupabaseClient {
  if (adminClient) return adminClient;

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error('Supabase is not configured. Set SUPABASE_SERVICE_ROLE_KEY.');
  }

  adminClient = createClient(getSupabaseUrl(), serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  return adminClient;
}
