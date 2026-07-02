/**
 * Recognition of official-document source URLs (the QR codes printed on/with the physical
 * document). Each entry mirrors a row in the verifiable-link-issuer `allowed_sources` table —
 * the wallet-side check only exists for instant UX feedback; the issuer re-validates
 * authoritatively before fetching anything.
 */

export interface DocumentSource {
  /** Stable id, also used to pick the right flow screen. */
  documentId: 'mdl-mm'
  hosts: string[]
  pathPrefix: string
  requiredParams: string[]
}

export const MDL_MM_SOURCE: DocumentSource = {
  documentId: 'mdl-mm',
  hosts: ['mdl.rtad.gov.mm'],
  pathPrefix: '/detail',
  requiredParams: ['id', 'nrc'],
}

const documentSources: DocumentSource[] = [MDL_MM_SOURCE]

export function matchDocumentSourceUrl(data: string): { source: DocumentSource; sourceUrl: string } | null {
  let url: URL
  try {
    url = new URL(data.trim())
  } catch {
    return null
  }
  if (url.protocol !== 'https:') return null

  const source = documentSources.find(
    (s) =>
      s.hosts.includes(url.hostname) &&
      url.pathname.startsWith(s.pathPrefix) &&
      s.requiredParams.every((p) => url.searchParams.has(p))
  )
  if (!source) return null
  return { source, sourceUrl: url.toString() }
}

// The source URL carries holder PII in its query string (e.g. the NRC number), so it must not
// travel through router params — react-navigation can persist navigation state to disk. The
// scanner stashes it here and the document flow consumes it once.
let pendingSourceUrl: string | null = null

export function stashPendingSourceUrl(url: string) {
  pendingSourceUrl = url
}

export function consumePendingSourceUrl(): string | null {
  const url = pendingSourceUrl
  pendingSourceUrl = null
  return url
}
