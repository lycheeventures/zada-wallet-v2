import type { useAppAgent } from '@easypid/agent'
import {
  trustedDidEntities,
  trustedOpenId4VciIssuerEntities,
  trustedX509Entities,
  walletClient,
} from '@easypid/constants'
import {
  acquirePreAuthorizedAccessToken,
  receiveCredentialFromOpenId4VciOffer,
  resolveOpenId4VciOffer,
  storeCredential,
} from '@package/agent'

type AppAgent = ReturnType<typeof useAppAgent>['agent']

/**
 * Accept ONE pre-authorized OpenID4VCI offer end-to-end and store the credential, with no UI.
 *
 * Used wherever the user has already made the per-credential choice on a list (batch migration
 * from the web flow, the native ZADA ID flow) so each offer doesn't need its own accept screen.
 * Hovi issues these offers without a transaction code, so no PIN is needed. Trust is still
 * anchored per-offer through `resolveOpenId4VciOffer` (ZADA x5c issuer trust).
 */
export async function acceptPreAuthorizedOffer(agent: AppAgent, uri: string): Promise<void> {
  const { resolvedCredentialOffer } = await resolveOpenId4VciOffer({
    agent,
    offer: { uri },
    authorization: walletClient,
    trustedX509Entities,
    trustedDidEntities,
    trustedOpenId4VciIssuerEntities,
  })

  const preAuthGrant =
    resolvedCredentialOffer.credentialOfferPayload.grants?.['urn:ietf:params:oauth:grant-type:pre-authorized_code']
  if (!preAuthGrant) throw new Error('Offer is not a pre-authorized credential offer')
  if (preAuthGrant.tx_code) throw new Error('Offer requires a transaction code; cannot accept without a prompt')

  const configurationId = Object.keys(resolvedCredentialOffer.offeredCredentialConfigurations)[0]
  if (!configurationId) throw new Error('Offer has no credential configuration')

  const tokenResponse = await acquirePreAuthorizedAccessToken({
    agent,
    resolvedCredentialOffer,
    txCode: undefined,
  })

  const { credentials } = await receiveCredentialFromOpenId4VciOffer({
    agent,
    resolvedCredentialOffer,
    credentialConfigurationIdsToRequest: [configurationId],
    accessToken: tokenResponse,
    requestBatch: true,
  })
  if (!credentials.length) throw new Error('Issuer returned no credential')

  await storeCredential(agent, credentials[0].credential)
}
