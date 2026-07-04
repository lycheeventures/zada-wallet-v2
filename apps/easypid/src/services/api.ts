import { supabase } from './supabase'

export async function getTrustRegistryEntriesByIssuer(issuer: string) {
  const { data, error } = await supabase.rpc('get_trust_registry_entry_by_entity_id', { p_entity_id: issuer })

  if (error) {
    return { trusted: false, org: null }
  }

  const isTrusted = data && data.length > 0

  return {
    trusted: isTrusted,
    org: isTrusted ? data[0] : null,
  }
}

export type ZadaTrustRegistryIssuer = {
  org_id: string
  name: string
  demo?: boolean
  logo_url?: string | null
  credential_issuer_url?: string | null
  did?: string | null
  x509_certificate?: string | null
}

/**
 * Fetch the full ZADA trust-registry feed (all approved members + their published x509 trust
 * anchors). Used to recognise an OID4VP VERIFIER: Hovi signs each org's proof requests with that
 * org's registry-published leaf cert, so the wallet matches the request's x5c to a cert here.
 * Verifiers can't be keyed by URL (all Hovi orgs share an origin), hence the cert-list approach.
 */
export async function getZadaTrustRegistryIssuers(): Promise<ZadaTrustRegistryIssuer[]> {
  const { data, error } = await supabase.functions.invoke('trust-registry', { method: 'GET' })
  if (error || !data?.issuers) return []
  return data.issuers as ZadaTrustRegistryIssuer[]
}
