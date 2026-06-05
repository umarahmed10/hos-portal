// Browser-safe Supabase client (anon key only).
// Imported ONLY by Client Components ("use client") for client-facing reads.
// All admin writes go through API routes which use the service role key server-side.
import { createClient } from "@supabase/supabase-js";

const url     = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(url, anonKey, {
  auth: { persistSession: false },
});
