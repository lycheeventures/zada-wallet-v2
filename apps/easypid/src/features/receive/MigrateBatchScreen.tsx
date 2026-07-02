import { useAppAgent } from '@easypid/agent'
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
import { usePushToWallet } from '@package/app'
import { Button, FlexPage, Heading, HeroIcons, Paragraph, ProgressBar, Spinner, YStack } from '@package/ui'
import { useLocalSearchParams } from 'expo-router'
import { useEffect, useRef, useState } from 'react'

type Query = { offers: string }

/**
 * Batch credential import. The credential-key-usher web flow lets the user select several
 * credentials (their migrated legacy credentials + a new ZADA ID). Instead of handing back one
 * `openid-credential-offer://` deep link per credential (one wallet round-trip each), it hands
 * back a single `id.animo.paradym:///wallet/credential-offer-batch?offers=[...]` deep link whose
 * `offers` param is a JSON array of the individual offer URIs. This screen accepts them all in
 * one pass.
 *
 * Each offer is a pre-authorized OID4VCI offer with no transaction code (Hovi issues them that
 * way for migration), so no PIN is needed. Trust is still anchored per-offer via
 * `resolveOpenId4VciOffer` (ZADA x5c issuer trust). Offers that fail are skipped and counted;
 * the rest still import.
 */
function decodeOffers(raw: string | undefined): string[] {
  if (!raw) return []
  const tryParse = (s: string): string[] | null => {
    try {
      const arr = JSON.parse(s)
      return Array.isArray(arr) ? arr.filter((x): x is string => typeof x === 'string') : null
    } catch {
      return null
    }
  }
  return tryParse(raw) ?? tryParse(decodeURIComponent(raw)) ?? []
}

export function MigrateBatchScreen() {
  const { agent } = useAppAgent()
  const pushToWallet = usePushToWallet()
  const params = useLocalSearchParams<Query>()
  const offersRef = useRef<string[]>(decodeOffers(params.offers))

  const [done, setDone] = useState(0)
  const [failed, setFailed] = useState(0)
  const [finished, setFinished] = useState(false)
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true

    const acceptOne = async (uri: string) => {
      const { resolvedCredentialOffer } = await resolveOpenId4VciOffer({
        agent,
        offer: { uri },
        authorization: walletClient,
        trustedX509Entities,
        trustedDidEntities,
        trustedOpenId4VciIssuerEntities,
      })

      const preAuthGrant =
        resolvedCredentialOffer.credentialOfferPayload.grants?.[
          'urn:ietf:params:oauth:grant-type:pre-authorized_code'
        ]
      if (!preAuthGrant) throw new Error('Offer is not a pre-authorized credential offer')
      if (preAuthGrant.tx_code) throw new Error('Offer requires a transaction code; cannot batch-accept')

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

    void (async () => {
      for (const uri of offersRef.current) {
        try {
          await acceptOne(uri)
          setDone((n) => n + 1)
        } catch (error) {
          agent.config.logger.error('Batch credential accept failed for one offer', { error })
          setFailed((n) => n + 1)
        }
      }
      setFinished(true)
    })()
  }, [agent])

  const total = offersRef.current.length
  const processed = done + failed
  const progress = total ? Math.round((processed / total) * 100) : 100

  return (
    <FlexPage flex-1 alignItems="center" justifyContent="center" gap="$4">
      <YStack gap="$4" alignItems="center" maxWidth={360} width="100%">
        {!finished ? (
          <>
            <Spinner />
            <Heading variant="h2" ta="center">
              Adding your credentials…
            </Heading>
            <Paragraph ta="center" color="$grey-500">
              {processed} of {total} added. Keep the app open.
            </Paragraph>
          </>
        ) : (
          <>
            {failed === 0 ? (
              <HeroIcons.CheckCircleFilled color="$positive-500" size={48} />
            ) : (
              <HeroIcons.ExclamationCircleFilled color="$warning-500" size={48} />
            )}
            <Heading variant="h2" ta="center">
              {failed === 0 ? 'All set' : 'Almost there'}
            </Heading>
            <Paragraph ta="center" color="$grey-500">
              {done} credential{done === 1 ? '' : 's'} added to your wallet
              {failed ? `, ${failed} couldn't be added` : ''}.
            </Paragraph>
          </>
        )}

        <YStack width="100%" gap="$4" alignItems="center">
          <ProgressBar value={progress} />
          {finished && <Button.Solid onPress={() => pushToWallet()}>Done</Button.Solid>}
        </YStack>
      </YStack>
    </FlexPage>
  )
}
