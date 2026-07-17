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
import * as WebBrowser from 'expo-web-browser'
import { useEffect, useRef, useState } from 'react'

type Query = { offers?: string; batch?: string }

// credential-key-usher (the migration web app) Supabase project. The batch offer list is
// stored server-side and fetched here by a short token, so the deep link stays tiny. The
// anon key is a publishable key; the `get_migration_batch` RPC only returns the (public,
// single-use) OID4VCI offer URIs for that batch — no secrets.
const USHER_SUPABASE_URL = 'https://sdztukqgwhiwrfekzbya.supabase.co'
const USHER_SUPABASE_ANON =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNkenR1a3Fnd2hpd3JmZWt6YnlhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4NDM3MDAsImV4cCI6MjA5MjQxOTcwMH0.odLo1JGMMDgG7ugjck99VzNf2Vz3ZtKY9u1-EwowXuE'

/**
 * Batch credential import. The credential-key-usher web flow lets the user select several
 * credentials (their migrated legacy credentials + a new ZADA ID) and import them all from a
 * single tap. Hovi issues one credential per offer, so we can't batch at the offer level — the
 * wallet loops through the individual pre-authorized OID4VCI offer URIs.
 *
 * The web app hands us a single `id.animo.paradym:///wallet/credential-offer-batch` deep link.
 * The offer list is NOT carried inline (a dozen offer URIs blows past the length at which
 * Android/Chrome silently truncate a custom-scheme URL, which left the wallet on the home
 * screen). Instead the deep link carries a short `batch` token; we exchange it for the offer
 * list via the usher's `get_migration_batch` RPC. A legacy inline `offers` param (a JSON array)
 * is still accepted for back-compat.
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

async function fetchBatchOffers(batchId: string): Promise<string[]> {
  const res = await fetch(`${USHER_SUPABASE_URL}/rest/v1/rpc/get_migration_batch`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: USHER_SUPABASE_ANON,
      Authorization: `Bearer ${USHER_SUPABASE_ANON}`,
    },
    body: JSON.stringify({ p_id: batchId }),
  })
  if (!res.ok) throw new Error(`Batch lookup failed (${res.status})`)
  // The RPC returns the stored jsonb array directly (or null for an unknown/expired token).
  const data = (await res.json()) as unknown
  if (!Array.isArray(data)) return []
  return data.filter((x): x is string => typeof x === 'string')
}

export function MigrateBatchScreen() {
  const { agent } = useAppAgent()
  const pushToWallet = usePushToWallet()
  const params = useLocalSearchParams<Query>()

  const [total, setTotal] = useState(0)
  const [done, setDone] = useState(0)
  const [failed, setFailed] = useState(0)
  const [finished, setFinished] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true

    // The migration web flow runs in an in-app browser (`useCredentialMigration` →
    // WebBrowser.openBrowserAsync). On iOS that's an SFSafariViewController which stays
    // presented when the deep link brings us here, so the user would watch a blank overlay
    // while the import ran behind it and have to close it by hand. Dismiss it ourselves.
    // iOS-only API — it throws on Android (where the Custom Tab is already backgrounded),
    // hence the catch.
    WebBrowser.dismissBrowser().catch(() => {})

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
        resolvedCredentialOffer.credentialOfferPayload.grants?.['urn:ietf:params:oauth:grant-type:pre-authorized_code']
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
      // Resolve the offer list: a short `batch` token (fetched server-side) or, for
      // back-compat, an inline `offers` JSON array.
      let offers: string[] = []
      try {
        offers = params.batch ? await fetchBatchOffers(params.batch) : decodeOffers(params.offers)
      } catch (error) {
        agent.config.logger.error('Failed to load batch offer list', { error })
        setLoadError(true)
        setFinished(true)
        return
      }

      setTotal(offers.length)
      if (offers.length === 0) {
        setLoadError(true)
        setFinished(true)
        return
      }

      for (const uri of offers) {
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
  }, [agent, params.batch, params.offers])

  const processed = done + failed
  const progress = total ? Math.round((processed / total) * 100) : finished ? 100 : 0

  return (
    <FlexPage flex-1 alignItems="center" justifyContent="center" gap="$4">
      <YStack gap="$4" alignItems="center" maxWidth={360} width="100%">
        {!finished ? (
          <>
            <Spinner />
            <Heading heading="h2" ta="center">
              Adding your credentials…
            </Heading>
            <Paragraph ta="center" color="$grey-500">
              {total ? `${processed} of ${total} added. Keep the app open.` : 'Preparing your credentials…'}
            </Paragraph>
          </>
        ) : loadError ? (
          <>
            <HeroIcons.ExclamationCircleFilled color="$warning-500" size={48} />
            <Heading heading="h2" ta="center">
              Nothing to add
            </Heading>
            <Paragraph ta="center" color="$grey-500">
              We couldn't load your credentials. Please head back to the migration page and try again.
            </Paragraph>
          </>
        ) : (
          <>
            {failed === 0 ? (
              <HeroIcons.CheckCircleFilled color="$positive-500" size={48} />
            ) : (
              <HeroIcons.ExclamationCircleFilled color="$warning-500" size={48} />
            )}
            <Heading heading="h2" ta="center">
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
