import { createClient } from '@supabase/supabase-js'

/**
 * The network hub's Supabase.
 *
 * The URL is configurable because `*.supabase.co` is unreachable from Myanmar — the country blocks
 * the Cloudflare anycast ranges every Supabase project resolves into, so TCP is refused outright.
 * `https://api.zada.solutions/hub` is ZADA's own proxy for that, on an IP that is reachable.
 *
 * The default stays on the direct URL so this build behaves exactly as before: flip
 * EXPO_PUBLIC_ZADA_HUB_URL in eas.json once the proxy is deployed and verified from a Myanmar
 * connection. Trust resolution does NOT depend on this — see services/zadaRegistry.ts, which
 * carries its own endpoint list and an offline fallback.
 */
const HUB_URL = process.env.EXPO_PUBLIC_ZADA_HUB_URL ?? 'https://kabjxgfdhszeninntlto.supabase.co'

export const supabase = createClient(
  HUB_URL,
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImthYmp4Z2ZkaHN6ZW5pbm50bHRvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDUxNzk4MDUsImV4cCI6MjA2MDc1NTgwNX0.1ynyjq_lnPcfZOOd4nVv4Z-jCy8pdDVMPmCye6pZmvo'
)
