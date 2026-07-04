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

  // Match case-insensitively: the RTAD portal is an ASP.NET site whose real links vary in case
  // (e.g. `/Detail.aspx`, `Id`, `NRC`), so a case-sensitive check would reject valid licenses.
  // `url.hostname` is already lower-cased by the URL parser.
  const hostname = url.hostname
  const pathname = url.pathname.toLowerCase()
  const paramNames = new Set(Array.from(url.searchParams.keys(), (k) => k.toLowerCase()))

  const source = documentSources.find(
    (s) =>
      s.hosts.some((h) => h.toLowerCase() === hostname) &&
      pathname.startsWith(s.pathPrefix.toLowerCase()) &&
      s.requiredParams.every((p) => paramNames.has(p.toLowerCase()))
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
