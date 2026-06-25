import { Jwt } from '@credo-ts/core'
import type { MdocRecord, SdJwtVcRecord, W3cCredentialRecord, W3cV2CredentialRecord } from '@credo-ts/core'

type CredentialRecord = W3cCredentialRecord | W3cV2CredentialRecord | SdJwtVcRecord | MdocRecord

/** Verified ZADA issuer trust persisted on a credential (Path B — anchored on the credential's x5c). */
export interface ZadaIssuerTrust {
  verified: boolean
  organizationName?: string
  logoUri?: string
  uri?: string
  entityId?: string
}

const zadaIssuerTrustKey = '_zada/issuerTrust'

/**
 * Extract the issuer x5c certificate chain from a stored credential. For dc+sd-jwt VCs the chain
 * sits in the issuer-signed JWT header (Hovi puts the same leaf cert there as in signed metadata),
 * so trust can be verified from the credential itself — before signed issuer metadata is enabled.
 * Returns undefined for formats/credentials without an x5c chain.
 */
export function extractIssuerX5c(record: CredentialRecord): string[] | undefined {
  try {
    // biome-ignore lint/suspicious/noExplicitAny: credo SD-JWT record shapes vary across versions
    const rec = record as any
    const headerX5c = rec?.firstCredential?.header?.x5c
    if (Array.isArray(headerX5c) && headerX5c.length) return headerX5c as string[]

    // Fall back to parsing the compact SD-JWT's issuer JWT header.
    const compact: unknown = rec?.compactSdJwtVc ?? rec?.firstCredential?.compact
    if (typeof compact === 'string' && compact.length) {
      const issuerJwt = compact.split('~')[0]
      const header = Jwt.fromSerializedJwt(issuerJwt).header as { x5c?: string[] }
      if (Array.isArray(header.x5c) && header.x5c.length) return header.x5c
    }
  } catch {
    // no x5c extractable → treat as no cold trust
  }
  return undefined
}

/** Persist the verified ZADA issuer trust onto a credential record (rides the same save as OpenID4VC metadata). */
export function setZadaIssuerTrust(record: CredentialRecord, trust: ZadaIssuerTrust): void {
  record.metadata.set(zadaIssuerTrustKey, trust)
}

/** Read the persisted ZADA issuer trust from a credential record. */
export function getZadaIssuerTrust(record: CredentialRecord): ZadaIssuerTrust | null {
  return record.metadata.get<ZadaIssuerTrust>(zadaIssuerTrustKey) ?? null
}
