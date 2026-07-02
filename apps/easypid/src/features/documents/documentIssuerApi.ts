/**
 * Thin client for the verifiable-link-issuer public API: it turns an allow-listed source URL
 * (e.g. a Myanmar driver license detail page on the RTAD portal) into an OpenID4VCI credential
 * offer, minted server-side via Hovi. The wallet never scrapes or signs anything itself.
 *
 * The API key is intentionally low-value: it can only trigger issuance from allow-listed
 * public government pages and is individually revocable server-side.
 *
 * Set these in the app env (e.g. .env / eas.json):
 *   EXPO_PUBLIC_DOCUMENT_ISSUER_URL=https://<verifiable-link-issuer host>
 *   EXPO_PUBLIC_DOCUMENT_ISSUER_API_KEY=vci_...
 */
export const DOCUMENT_ISSUER_URL = process.env.EXPO_PUBLIC_DOCUMENT_ISSUER_URL ?? ''
export const DOCUMENT_ISSUER_API_KEY = process.env.EXPO_PUBLIC_DOCUMENT_ISSUER_API_KEY ?? ''

export function isDocumentIssuerConfigured(): boolean {
  return DOCUMENT_ISSUER_URL !== '' && DOCUMENT_ISSUER_API_KEY !== ''
}

interface IssueResponse {
  offer_url: string
  credential_type: string
  issued_at: string
}

/** Exchange a recognized source URL for an openid-credential-offer:// deeplink. */
export async function requestOfferFromSourceUrl(sourceUrl: string): Promise<string> {
  if (!isDocumentIssuerConfigured()) {
    throw new Error('Document issuer is not configured for this build.')
  }

  const res = await fetch(`${DOCUMENT_ISSUER_URL}/api/public/v1/credentials/issue`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${DOCUMENT_ISSUER_API_KEY}`,
    },
    body: JSON.stringify({ source_url: sourceUrl }),
  })

  if (!res.ok) {
    let errorCode = `http_${res.status}`
    try {
      const body = (await res.json()) as { error?: string }
      if (body.error) errorCode = body.error
    } catch {
      // non-JSON error body — keep the status code
    }
    throw new Error(errorCode)
  }

  const data = (await res.json()) as IssueResponse
  if (!data.offer_url) throw new Error('missing_offer_url')
  return data.offer_url
}
