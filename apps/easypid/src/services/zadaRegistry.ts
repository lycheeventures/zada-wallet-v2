/**
 * The ZADA trust registry, available offline.
 *
 * WHY THIS EXISTS
 * Trust used to be resolved by fetching the registry feed live, inside the verify/receive flow,
 * with no cache and no retry — and failing *closed*: any network error returned an empty list,
 * which renders identically to "this organisation is not in the registry". On 2026-08-29 that
 * turned out to be more than a theoretical weakness: Myanmar blocks the Cloudflare anycast ranges
 * every `*.supabase.co` host lives on, so for wallet users in ZADA's main market the registry is
 * simply unreachable and every verifier showed as "unknown organisation" — a *false statement*,
 * not a missing one.
 *
 * So the registry is now data the wallet HAS, not a call it makes:
 *
 *   1. in-memory        — within a session
 *   2. MMKV cache       — last successfully fetched feed, across launches
 *   3. bundled snapshot — shipped in the binary, so a wallet that has never had a working
 *                         connection to the registry still recognises the network
 *
 * A refresh runs in the background and upgrades the cache whenever the network allows.
 *
 * SECURITY: this changes *availability*, not the trust decision. Callers still validate the
 * presented x5c chain against the certificate published for that organisation — this module only
 * decides which certificates are on the table. A stale snapshot can therefore make the wallet
 * miss an organisation added after the build, or keep recognising one removed since; it can never
 * make it accept a certificate ZADA did not publish. `isStale()` exists so the UI can say
 * "couldn't check" instead of asserting "not verified".
 */
import { mmkv } from '@easypid/storage/mmkv'
import bundledSnapshot from './zadaRegistrySnapshot.json'

export type ZadaRegistryIssuer = {
  org_id: string
  name: string
  demo?: boolean
  logo_url?: string | null
  credential_issuer_url?: string | null
  x509_certificate?: string | null
}

type RegistryFeed = {
  generated_at?: string
  issuers: ZadaRegistryIssuer[]
}

export type ZadaRegistrySource = 'network' | 'cache' | 'bundled'

const K_FEED = 'zada.registry.feed'
const K_FETCHED_AT = 'zada.registry.fetchedAt'
const K_LAST_GOOD_ENDPOINT = 'zada.registry.endpoint'

/** Serve from cache without asking the network at all. */
const FRESH_MS = 6 * 60 * 60 * 1000 // 6h
/** Past this the data is "stale": still used, but the UI may say it could not be confirmed. */
const STALE_MS = 7 * 24 * 60 * 60 * 1000 // 7d
/** Bounded so a blocked or crawling network can never hold up the verify screen. */
const FETCH_TIMEOUT_MS = 5000

/**
 * Endpoints, in order. `api.zada.solutions` is ZADA's own proxy, on an IP that is reachable from
 * Myanmar; the direct Supabase URL stays as a fallback so this build works whether or not the
 * proxy is deployed. The endpoint that last worked is tried first on subsequent runs.
 */
const PROXY_BASE = process.env.EXPO_PUBLIC_ZADA_REGISTRY_URL ?? 'https://api.zada.solutions/hub'
const DIRECT_BASE = 'https://kabjxgfdhszeninntlto.supabase.co'
const FEED_PATH = '/functions/v1/trust-registry'

const SUPABASE_ASSET_ORIGIN = `${DIRECT_BASE}/storage/`

let memoryFeed: RegistryFeed | undefined
let memoryFetchedAt = 0
let inFlight: Promise<RegistryFeed | undefined> | undefined

const bundled = bundledSnapshot as RegistryFeed

const isFeed = (value: unknown): value is RegistryFeed =>
  !!value && typeof value === 'object' && Array.isArray((value as RegistryFeed).issuers)

const readCache = (): { feed?: RegistryFeed; fetchedAt: number } => {
  try {
    const raw = mmkv.getString(K_FEED)
    const fetchedAt = mmkv.getNumber(K_FETCHED_AT) ?? 0
    if (!raw) return { fetchedAt: 0 }
    const parsed = JSON.parse(raw)
    // A cached feed with no issuers is worse than the bundled one — treat it as absent.
    if (!isFeed(parsed) || parsed.issuers.length === 0) return { fetchedAt: 0 }
    return { feed: parsed, fetchedAt }
  } catch {
    return { fetchedAt: 0 }
  }
}

const writeCache = (feed: RegistryFeed, fetchedAt: number) => {
  try {
    mmkv.set(K_FEED, JSON.stringify(feed))
    mmkv.set(K_FETCHED_AT, fetchedAt)
  } catch (error) {
    // A full or unavailable MMKV must not break trust resolution — we still have the feed in memory.
    console.warn('ZADA registry: could not persist the feed', error)
  }
}

const fetchFrom = async (base: string): Promise<RegistryFeed | undefined> => {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const response = await fetch(`${base}${FEED_PATH}`, {
      method: 'GET',
      headers: { accept: 'application/json' },
      signal: controller.signal,
    })
    if (!response.ok) return undefined
    const body = await response.json()
    if (!isFeed(body) || body.issuers.length === 0) return undefined
    return body
  } catch {
    // Blocked, offline, timed out — all the same to us: keep whatever we already have.
    return undefined
  } finally {
    clearTimeout(timeout)
  }
}

const refresh = async (): Promise<RegistryFeed | undefined> => {
  if (inFlight) return inFlight

  inFlight = (async () => {
    // Try whichever endpoint worked last time first — on a blocked network that avoids paying the
    // (fast, ~100 ms) refusal every single time.
    const lastGood = mmkv.getString(K_LAST_GOOD_ENDPOINT)
    const ordered = lastGood === DIRECT_BASE ? [DIRECT_BASE, PROXY_BASE] : [PROXY_BASE, DIRECT_BASE]
    const bases = [...new Set(ordered)]

    for (const base of bases) {
      const feed = await fetchFrom(base)
      if (feed) {
        const now = Date.now()
        memoryFeed = feed
        memoryFetchedAt = now
        writeCache(feed, now)
        try {
          mmkv.set(K_LAST_GOOD_ENDPOINT, base)
        } catch {
          // best-effort only
        }
        return feed
      }
    }
    return undefined
  })().finally(() => {
    inFlight = undefined
  })

  return inFlight
}

/** Kick off a refresh without waiting for it. Safe to call often — concurrent calls share one request. */
export const refreshZadaRegistryInBackground = () => {
  void refresh().catch(() => {
    // never surfaces; the caller already has usable data
  })
}

const currentFetchedAt = (): number => {
  if (memoryFeed) return memoryFetchedAt
  return readCache().fetchedAt
}

/**
 * The registry as the wallet currently knows it. Never throws, never returns empty, never blocks
 * on the network for longer than FETCH_TIMEOUT_MS — and only waits at all when what we have is
 * older than FRESH_MS.
 */
export const getZadaRegistryIssuers = async (): Promise<ZadaRegistryIssuer[]> => {
  const now = Date.now()

  if (memoryFeed && now - memoryFetchedAt < FRESH_MS) return memoryFeed.issuers

  const cached = readCache()
  if (cached.feed) {
    memoryFeed = cached.feed
    memoryFetchedAt = cached.fetchedAt
    if (now - cached.fetchedAt < FRESH_MS) return cached.feed.issuers
  }

  // What we have is old (or we have nothing but the bundle): try the network, but bounded.
  // Where the registry is blocked the connection is refused in ~100 ms, so this costs nothing.
  const fresh = await refresh()
  if (fresh) return fresh.issuers

  return (memoryFeed ?? bundled).issuers
}

/** Registry entry for a credential issuer URL (the SD-JWT `issuer` / OID4VCI credential_issuer). */
export const getZadaRegistryIssuerByUrl = async (issuer?: string): Promise<ZadaRegistryIssuer | undefined> => {
  if (!issuer) return undefined
  const normalise = (value: string) => value.replace(/\/+$/, '')
  const target = normalise(issuer)
  const issuers = await getZadaRegistryIssuers()
  return issuers.find((org) => org.credential_issuer_url && normalise(org.credential_issuer_url) === target)
}

/**
 * True when the registry data on this device is old enough that "not found" should be reported as
 * "we could not check", rather than as "not in the registry".
 */
export const isZadaRegistryStale = (): boolean => Date.now() - currentFetchedAt() > STALE_MS

export const getZadaRegistrySource = (): ZadaRegistrySource => {
  if (memoryFetchedAt > 0) return 'network'
  return readCache().feed ? 'cache' : 'bundled'
}

/** Epoch ms of the last successful fetch, or undefined when only the bundled snapshot is in play. */
export const getZadaRegistryFetchedAt = (): number | undefined => currentFetchedAt() || undefined

/**
 * Org logos are stored as absolute `<project>.supabase.co/storage/...` URLs, so they are blocked
 * wherever the registry itself is. Point them at the proxy so the badge is not a broken image.
 */
export const rewriteZadaAssetUrl = (url?: string | null): string | undefined => {
  if (!url) return undefined
  if (!url.startsWith(SUPABASE_ASSET_ORIGIN)) return url
  return `${PROXY_BASE}/storage/${url.slice(SUPABASE_ASSET_ORIGIN.length)}`
}
