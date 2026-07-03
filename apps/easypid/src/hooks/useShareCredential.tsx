import { coldCredentialUrl } from '@easypid/constants'
import type { CredentialForDisplay } from '@package/agent/display'
import * as FileSystem from 'expo-file-system/legacy'
import * as Print from 'expo-print'

// Cold-credential artifacts are stored ON-DEVICE (never uploaded): the PDF is the full credential,
// so keeping it local preserves privacy and makes repeat access work offline. Per credential id we
// cache the PDF (zada-cold/<id>.pdf) and the QR payload (zada-cold/<id>.json). A cache entry only
// counts when BOTH exist (i.e. a real cold copy) — a basic fallback PDF is never cached.
const COLD_DIR = `${FileSystem.documentDirectory}zada-cold/`
const safeId = (credential: CredentialForDisplay) => String(credential.id).replace(/[^\w-]/g, '_')
const pdfFor = (credential: CredentialForDisplay) => `${COLD_DIR}${safeId(credential)}.pdf`
const metaFor = (credential: CredentialForDisplay) => `${COLD_DIR}${safeId(credential)}.json`

async function readCachedZada(credential: CredentialForDisplay): Promise<string | undefined> {
  try {
    const info = await FileSystem.getInfoAsync(metaFor(credential))
    if (!info.exists) return undefined
    const { zada } = JSON.parse(await FileSystem.readAsStringAsync(metaFor(credential)))
    return typeof zada === 'string' ? zada : undefined
  } catch {
    return undefined
  }
}

// The compact SD-JWT VC. Hovi issues `dc+sd-jwt`, whose record exposes it at firstCredential.compact
// (SdJwtVcRecord uses compactSdJwtVc) — mirror packages/agent/src/openid4vc/zadaTrust.ts.
function getCompactSdJwt(credential: CredentialForDisplay): string | undefined {
  // biome-ignore lint/suspicious/noExplicitAny: credo record shapes vary across formats/versions
  const rec = credential.record as any
  const compact = rec?.compactSdJwtVc ?? rec?.firstCredential?.compact
  return typeof compact === 'string' && compact.length ? compact : undefined
}

export interface ColdCredentialResult {
  /** on-device path to the offline PDF */
  path: string
  /** the ZADA:… QR payload (verifier-scannable). Absent only for the basic non-cold fallback. */
  zada?: string
  /** true if just generated; false if served from the on-device cache */
  created: boolean
  /** set when generation failed so the caller can message the user */
  error?: 'offline' | 'untrusted' | 'failed'
}

// Basic local-only PDF (previous behaviour) for credentials that aren't SD-JWT VCs. Not cached.
async function simplePdf(credential: CredentialForDisplay): Promise<string> {
  const rows = (credential.attributes ?? [])
    .map(
      (a: { label?: string; name?: string; value?: unknown }) =>
        `<p><strong>${a?.label || a?.name || ''}:</strong> ${a?.value ?? ''}</p>`
    )
    .join('')
  const html = `<html><body style="font-family: Arial; padding: 24px;"><h2>${credential.display?.name ?? 'Credential'}</h2><hr/>${rows}</body></html>`
  return (await Print.printToFileAsync({ html })).uri
}

/**
 * Get an offline, ZADA-signed cold-credential (PDF + QR payload) for a credential.
 * - Reuses the on-device cold copy if present (works offline; instant).
 * - Otherwise presents the held SD-JWT VC to trust-bound-roots (`/api/v1/request-cold`), which
 *   verifies it and returns filled HTML + the cold QR payload (`zada`); we render the HTML to a PDF
 *   and cache both locally. No signing secret touches the device; nothing is uploaded.
 * - Non-SD-JWT credentials fall back to a basic local PDF (no QR).
 */
export async function getColdCredential(
  credential: CredentialForDisplay,
  opts: { forceRefresh?: boolean } = {}
): Promise<ColdCredentialResult> {
  const dest = pdfFor(credential)
  try {
    // 1. Reuse a VALID cached cold copy (pdf + zada) unless a refresh is requested.
    if (!opts.forceRefresh) {
      const cachedZada = await readCachedZada(credential)
      const info = await FileSystem.getInfoAsync(dest)
      if (info.exists && cachedZada) return { path: dest, created: false, zada: cachedZada }
    }

    // 2. Non-SD-JWT → basic local PDF (no cold QR), not cached.
    const compact = getCompactSdJwt(credential)
    if (!compact) return { path: await simplePdf(credential), created: true }

    // 3. Ask trust-bound-roots for the cold copy (filled HTML + QR payload).
    let res: Response
    try {
      res = await fetch(`${coldCredentialUrl}/api/v1/request-cold`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential: compact }),
      })
    } catch {
      return { path: dest, created: false, error: 'offline' }
    }
    if (!res.ok) return { path: dest, created: false, error: res.status === 403 ? 'untrusted' : 'failed' }
    const body = (await res.json()) as { html?: string; zada?: string }
    if (!body.html) return { path: dest, created: false, error: 'failed' }

    const pdfUri = (await Print.printToFileAsync({ html: body.html })).uri

    // 4. Persist on-device at stable paths so it opens offline next time.
    await FileSystem.makeDirectoryAsync(COLD_DIR, { intermediates: true }).catch(() => {})
    await FileSystem.deleteAsync(dest, { idempotent: true }).catch(() => {})
    await FileSystem.moveAsync({ from: pdfUri, to: dest })
    if (body.zada) await FileSystem.writeAsStringAsync(metaFor(credential), JSON.stringify({ zada: body.zada })).catch(() => {})
    return { path: dest, created: true, zada: body.zada }
  } catch (error) {
    console.log('Cold credential error:', error)
    return { path: dest, created: false, error: 'failed' }
  }
}
