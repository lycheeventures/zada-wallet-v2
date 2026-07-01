import { coldCredentialUrl } from '@easypid/constants'
import type { CredentialForDisplay } from '@package/agent/display'
import * as FileSystem from 'expo-file-system/legacy'
import * as Print from 'expo-print'

// Cold-credential PDFs are stored ON-DEVICE (never uploaded): the PDF is the full credential, so
// keeping it local preserves privacy and makes repeat access work offline. One stable file per
// credential id; regenerate only on an explicit refresh.
const COLD_DIR = `${FileSystem.documentDirectory}zada-cold/`
const fileFor = (credential: CredentialForDisplay) =>
  `${COLD_DIR}${String(credential.id).replace(/[^\w-]/g, '_')}.pdf`

export interface ColdPdfResult {
  path: string
  /** true if just generated online; false if opened from the on-device cache */
  created: boolean
  /** set when generation failed so the caller can message the user */
  error?: 'offline' | 'untrusted' | 'failed'
}

// Basic local-only PDF (previous behaviour) for credentials that aren't SD-JWT VCs.
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
 * Get an offline, ZADA-signed cold-credential PDF for a credential.
 * - Reuses the on-device copy if present (works offline; instant).
 * - Otherwise presents the held SD-JWT VC to trust-bound-roots (`/api/v1/request-cold`), which
 *   verifies it and returns filled HTML + a cold QR; we render that to a PDF and cache it locally.
 * No signing secret ever touches the device; the PDF is never uploaded.
 */
export async function getColdCredentialPdf(
  credential: CredentialForDisplay,
  opts: { forceRefresh?: boolean } = {}
): Promise<ColdPdfResult> {
  const dest = fileFor(credential)
  try {
    // 1. Reuse the cached offline copy unless a refresh is requested.
    if (!opts.forceRefresh) {
      const info = await FileSystem.getInfoAsync(dest)
      if (info.exists) return { path: dest, created: false }
    }

    // 2. Get the compact SD-JWT VC from the record.
    const record = credential.record as unknown as { compactSdJwtVc?: string } | undefined
    const compact = record?.compactSdJwtVc

    let pdfUri: string | null = null
    if (compact) {
      // 3. Ask trust-bound-roots for the cold copy (filled HTML + QR).
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
      if (!res.ok) {
        return { path: dest, created: false, error: res.status === 403 ? 'untrusted' : 'failed' }
      }
      const { html } = (await res.json()) as { html?: string }
      if (html) pdfUri = (await Print.printToFileAsync({ html })).uri
    }

    // 4. Fallback: a basic local PDF for non-SD-JWT credentials.
    if (!pdfUri) pdfUri = await simplePdf(credential)

    // 5. Persist on-device at a stable path so it opens offline next time.
    await FileSystem.makeDirectoryAsync(COLD_DIR, { intermediates: true }).catch(() => {})
    await FileSystem.deleteAsync(dest, { idempotent: true }).catch(() => {})
    await FileSystem.moveAsync({ from: pdfUri, to: dest })
    return { path: dest, created: true }
  } catch (error) {
    console.log('Cold credential PDF error:', error)
    return { path: dest, created: false, error: 'failed' }
  }
}
