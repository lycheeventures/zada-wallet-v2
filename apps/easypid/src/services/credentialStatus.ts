/**
 * Has the issuer revoked this credential?
 *
 * WHY THIS EXISTS
 * Credentials issued by ZADA's own issuer (Oct 2026 onwards) carry an IETF Token Status List
 * reference: `status.status_list = { uri, idx }`. The issuer flips that bit when it revokes the
 * credential and verifiers refuse it from then on — but the wallet never looked, so a revoked card
 * kept saying "Card is active" until the holder tried to use it and was turned away.
 *
 * WHAT THIS IS (AND IS NOT)
 * A DISPLAY signal for the holder. The verifier remains the authority: it checks the signed list
 * itself at presentation. So this module deliberately
 *   - fails OPEN: if the list cannot be fetched or read (offline, blocked network, odd format) the
 *     answer is "unknown" and the card shows nothing. An unreachable list must never be reported as
 *     "revoked" — in Myanmar that would be a false statement on every bad connection;
 *   - remembers the last known answer (MMKV), so a card that was revoked stays marked while offline;
 *   - does not verify the list's signature. It is fetched over HTTPS from the URI inside the
 *     issuer-signed credential; the worst a tampered list can do is mislabel a card on this device.
 *
 * Older credentials (issued through Hovi) have no `status` claim: nothing to check, never marked.
 */
import { ClaimFormat } from '@credo-ts/core'
import { mmkv } from '@easypid/storage/mmkv'
import type { CredentialForDisplay } from '@package/agent'
import { getListFromStatusListJWT } from '@sd-jwt/jwt-status-list'
import { useEffect, useState } from 'react'

type StatusReference = { uri: string; idx: number }
type CachedStatus = { revoked: boolean; checkedAt: number }

const K_PREFIX = 'zada.credentialStatus.'
/** Re-check a credential at most this often. The issuer's list is itself cached for ~5 minutes. */
const FRESH_MS = 5 * 60 * 1000
/** Bounded so a blocked or crawling network never holds anything up. */
const FETCH_TIMEOUT_MS = 6000

const inFlight = new Map<string, Promise<boolean | undefined>>()
/** One fetch per list per refresh window, however many cards point at it. */
const listCache = new Map<string, { jwt: string; fetchedAt: number }>()

const base64UrlToString = (value: string): string => {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/')
  const padded = base64 + '==='.slice((base64.length + 3) % 4)
  // atob exists in Hermes; decodeURIComponent/escape handles UTF-8 payloads.
  return decodeURIComponent(
    Array.from(atob(padded))
      .map((c) => `%${c.charCodeAt(0).toString(16).padStart(2, '0')}`)
      .join('')
  )
}

/** The status-list reference inside an SD-JWT VC, if it has one. */
export const getStatusReference = (compactSdJwtVc?: string | null): StatusReference | undefined => {
  if (!compactSdJwtVc) return undefined
  try {
    const jwt = compactSdJwtVc.split('~')[0]
    const payload = JSON.parse(base64UrlToString(jwt.split('.')[1])) as {
      status?: { status_list?: { uri?: unknown; idx?: unknown } }
    }
    const ref = payload.status?.status_list
    if (typeof ref?.uri !== 'string' || typeof ref?.idx !== 'number') return undefined
    if (!ref.uri.startsWith('https://')) return undefined
    return { uri: ref.uri, idx: ref.idx }
  } catch {
    return undefined
  }
}

const readCached = (credentialId: string): CachedStatus | undefined => {
  try {
    const raw = mmkv.getString(K_PREFIX + credentialId)
    if (!raw) return undefined
    const parsed = JSON.parse(raw) as CachedStatus
    return typeof parsed?.revoked === 'boolean' && typeof parsed?.checkedAt === 'number' ? parsed : undefined
  } catch {
    return undefined
  }
}

const writeCached = (credentialId: string, value: CachedStatus) => {
  try {
    mmkv.set(K_PREFIX + credentialId, JSON.stringify(value))
  } catch {
    // best effort: the next check simply asks again
  }
}

const fetchList = async (uri: string): Promise<string | undefined> => {
  const cached = listCache.get(uri)
  if (cached && Date.now() - cached.fetchedAt < FRESH_MS) return cached.jwt

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const response = await fetch(uri, {
      method: 'GET',
      headers: { accept: 'application/statuslist+jwt' },
      signal: controller.signal,
    })
    if (!response.ok) return undefined
    const jwt = (await response.text()).trim()
    if (jwt.split('.').length !== 3) return undefined
    listCache.set(uri, { jwt, fetchedAt: Date.now() })
    return jwt
  } catch {
    return undefined
  } finally {
    clearTimeout(timeout)
  }
}

/**
 * Ask the issuer's status list. `true` = revoked, `false` = valid, `undefined` = could not tell.
 * Never throws.
 */
export const checkCredentialRevoked = async (credentialId: string, compactSdJwtVc?: string | null) => {
  const ref = getStatusReference(compactSdJwtVc)
  if (!ref) return undefined

  const running = inFlight.get(credentialId)
  if (running) return running

  const run = (async (): Promise<boolean | undefined> => {
    const jwt = await fetchList(ref.uri)
    if (!jwt) return undefined
    try {
      // 0 = valid; anything else (1 revoked, 2 suspended, …) means the issuer no longer stands behind it.
      const revoked = getListFromStatusListJWT(jwt).getStatus(ref.idx) !== 0
      writeCached(credentialId, { revoked, checkedAt: Date.now() })
      return revoked
    } catch {
      return undefined
    }
  })().finally(() => inFlight.delete(credentialId))

  inFlight.set(credentialId, run)
  return run
}

/**
 * Revoked state for a card. Answers at once from what this device last learned, then re-checks in
 * the background when that is older than FRESH_MS. Unknown is reported as `false` (show nothing).
 */
export const useCredentialRevoked = (credentialId?: string, compactSdJwtVc?: string | null): boolean => {
  const [revoked, setRevoked] = useState<boolean>(() =>
    credentialId ? (readCached(credentialId)?.revoked ?? false) : false
  )

  useEffect(() => {
    if (!credentialId || !getStatusReference(compactSdJwtVc)) {
      setRevoked(false)
      return
    }
    const cached = readCached(credentialId)
    setRevoked(cached?.revoked ?? false)
    if (cached && Date.now() - cached.checkedAt < FRESH_MS) return

    let cancelled = false
    void checkCredentialRevoked(credentialId, compactSdJwtVc).then((result) => {
      if (!cancelled && result !== undefined) setRevoked(result)
    })
    return () => {
      cancelled = true
    }
  }, [credentialId, compactSdJwtVc])

  return revoked
}

/** Revoked state for a wallet card. Only SD-JWT VCs carry a status-list reference. */
export const useCredentialForDisplayRevoked = (credential?: CredentialForDisplay): boolean => {
  const compact =
    credential?.claimFormat === ClaimFormat.SdJwtDc ? (credential.record as { encoded?: string }).encoded : undefined
  return useCredentialRevoked(credential?.id, compact)
}

/**
 * For the share flow: is this credential KNOWN to be revoked? Uses a recent answer when there is
 * one, otherwise asks the issuer's list (bounded by FETCH_TIMEOUT_MS). If the list cannot be
 * reached, falls back to the last answer this device has; with none, the answer is `false` — an
 * unreachable status list must never keep a holder from presenting. Never throws.
 */
export const isCredentialRecordRevoked = async (record: { id: string; type: string }): Promise<boolean> => {
  if (record.type !== 'SdJwtVcRecord') return false
  const compact = (record as { encoded?: string }).encoded
  if (!getStatusReference(compact)) return false

  // Same key as the card hook (CredentialForDisplayId), so both share one remembered answer.
  const credentialId = `sd-jwt-vc-${record.id}`
  const cached = readCached(credentialId)
  if (cached && Date.now() - cached.checkedAt < FRESH_MS) return cached.revoked

  const fresh = await checkCredentialRevoked(credentialId, compact)
  return fresh ?? cached?.revoked ?? false
}
