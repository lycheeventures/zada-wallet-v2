import { supabase } from "./supabase"

export async function getTrustRegistryEntriesByIssuer(issuer: string) {
  const { data, error } = await supabase.rpc(
    'get_trust_registry_entry_by_entity_id',
    { p_entity_id: issuer }
  )

  if (error) {
    return { trusted: false, org: null }
  }

  const isTrusted = data && data.length > 0

  return {
    trusted: isTrusted,
    org: isTrusted ? data[0] : null,
  }
}