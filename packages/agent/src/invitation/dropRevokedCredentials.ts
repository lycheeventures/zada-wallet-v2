import type {
  DcqlQueryResult,
  MdocRecord,
  SdJwtVcRecord,
  W3cCredentialRecord,
  W3cV2CredentialRecord,
} from '@credo-ts/core'

type AnyCredentialRecord = MdocRecord | SdJwtVcRecord | W3cCredentialRecord | W3cV2CredentialRecord

/**
 * Tells whether the issuer has revoked a credential. Must resolve `true` only when revocation is
 * KNOWN; unknown (offline, unreadable status list, no status at all) is `false`. Must never throw.
 */
export type IsCredentialRevoked = (record: AnyCredentialRecord) => Promise<boolean>

/**
 * Remove revoked credentials from a resolved DCQL query result, in place.
 *
 * A verifier refuses a revoked credential, so offering one only produces a failed presentation and
 * a confusing error. Dropping it here — before the submission is formatted for the picker and
 * before any automatic selection — means the holder is either offered another matching credential
 * or told plainly that they have nothing to share.
 *
 * When every match for a credential query was revoked, that query becomes unsatisfied; the request
 * as a whole is then recomputed against its credential sets (or, without sets, requires every query).
 */
export async function dropRevokedCredentials(
  queryResult: DcqlQueryResult,
  isCredentialRevoked: IsCredentialRevoked
): Promise<{ dropped: number }> {
  // Loosely typed on purpose: the dcql result type is a deep discriminated union and we only touch
  // three well-known fields of it.
  const result = queryResult as unknown as {
    can_be_satisfied: boolean
    credentials: Array<{ id: string }>
    credential_matches: Record<string, { success: boolean; valid_credentials?: Array<{ record: AnyCredentialRecord }> }>
    credential_sets?: Array<{ required?: boolean; options: string[][]; matching_options?: string[][] }>
  }

  let dropped = 0
  for (const match of Object.values(result.credential_matches)) {
    if (!match.success || !match.valid_credentials?.length) continue

    const revoked = await Promise.all(
      match.valid_credentials.map((valid) => isCredentialRevoked(valid.record).catch(() => false))
    )
    if (!revoked.some(Boolean)) continue

    const kept = match.valid_credentials.filter((_, index) => !revoked[index])
    dropped += match.valid_credentials.length - kept.length
    match.valid_credentials = kept
    if (kept.length === 0) match.success = false
  }

  if (dropped === 0) return { dropped }

  const isSatisfied = (credentialQueryId: string) => result.credential_matches[credentialQueryId]?.success === true

  if (result.credential_sets?.length) {
    for (const set of result.credential_sets) {
      set.matching_options = set.options.filter((option) => option.every(isSatisfied))
    }
    result.can_be_satisfied = result.credential_sets.every(
      (set) => set.required === false || (set.matching_options?.length ?? 0) > 0
    )
  } else {
    result.can_be_satisfied = result.credentials.every((credential) => isSatisfied(credential.id))
  }

  return { dropped }
}
