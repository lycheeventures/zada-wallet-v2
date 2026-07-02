import { Trans, useLingui } from '@lingui/react/macro'
import { type CredentialDataHandlerOptions, useCredentialDataHandler } from '@package/app'
import { QrScanner } from '@package/scanner'
import { Button, Heading, Page, Paragraph, Spinner, YStack } from '@package/ui'
import { useRouter } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import { requestOfferFromSourceUrl } from './documentIssuerApi'
import { consumePendingSourceUrl, MDL_MM_SOURCE, matchDocumentSourceUrl } from './documentSources'

type Step = 'scan' | 'issuing'

/**
 * Adds a Myanmar driver license: scan the QR on the license/RTAD receipt → the
 * verifiable-link-issuer verifies the RTAD page and mints an SD-JWT VC via Hovi → the offer is
 * received on the normal credential rail, in-session (no deeplink bounce). If the main scanner
 * already recognized an RTAD URL it is stashed for us and the scan step is skipped.
 */
export function MdlFlow({
  credentialDataHandlerOptions,
}: {
  credentialDataHandlerOptions?: CredentialDataHandlerOptions
}) {
  const { t } = useLingui()
  const { back } = useRouter()
  const { handleCredentialData } = useCredentialDataHandler()

  const [sourceUrl] = useState<string | null>(() => consumePendingSourceUrl())
  const [step, setStep] = useState<Step>(sourceUrl ? 'issuing' : 'scan')
  const [error, setError] = useState<string | null>(null)
  const [helpText, setHelpText] = useState('')
  const isProcessing = useRef(false)

  const issue = async (url: string) => {
    setStep('issuing')
    setError(null)
    try {
      const offerUrl = await requestOfferFromSourceUrl(url)
      const result = await handleCredentialData(offerUrl, credentialDataHandlerOptions)
      if (!result.success) {
        setError(result.message ?? t({ id: 'mdlFlow.offerFailed', message: 'Could not load the credential offer.' }))
      }
      // On success, handleCredentialData routes to the credential-receipt screen; this modal unwinds.
    } catch (e) {
      setError(issueErrorMessage((e as Error)?.message))
    } finally {
      isProcessing.current = false
    }
  }

  // Map issuer error codes onto user-facing messages. Anything unexpected gets the generic one.
  const issueErrorMessage = (code?: string) => {
    if (code === 'url_not_allowed') {
      return t({
        id: 'mdlFlow.urlNotAllowed',
        message: 'This link is not recognized as an official license page.',
      })
    }
    if (code === 'source_fetch_failed') {
      return t({
        id: 'mdlFlow.sourceUnavailable',
        message: 'The license registry is not reachable right now. Try again later.',
      })
    }
    return t({ id: 'mdlFlow.issueFailed', message: 'Could not add your driver license. Try again.' })
  }

  const onScan = (data: string) => {
    if (isProcessing.current) return
    const match = matchDocumentSourceUrl(data)
    if (!match || match.source.documentId !== MDL_MM_SOURCE.documentId) {
      setHelpText(
        t({
          id: 'mdlFlow.notAnMdlQr',
          message: 'This QR code is not a Myanmar driver license link.',
        })
      )
      return
    }
    isProcessing.current = true
    void issue(match.sourceUrl)
  }

  // Auto-issue when the main scanner handed us a recognized URL.
  useEffect(() => {
    if (sourceUrl) {
      isProcessing.current = true
      void issue(sourceUrl)
    }
  }, [])

  if (step === 'scan') {
    return <QrScanner onScan={onScan} onCancel={() => back()} helpText={helpText} />
  }

  return (
    <Page f={1} jc="center" ai="center" gap="$4" p="$4">
      <Heading heading="h2" ta="center">
        <Trans id="mdlFlow.heading" comment="Heading while issuing the Myanmar driver license credential">
          Adding your driver license
        </Trans>
      </Heading>
      {error ? (
        <YStack gap="$3" w="100%" ai="center">
          <Paragraph ta="center" color="$danger-500">
            {error}
          </Paragraph>
          <Button.Solid
            onPress={() => {
              setError(null)
              setHelpText('')
              setStep('scan')
            }}
          >
            {t({ id: 'mdlFlow.retry', message: 'Scan again' })}
          </Button.Solid>
          <Button.Text onPress={() => back()}>{t({ id: 'mdlFlow.cancel', message: 'Cancel' })}</Button.Text>
        </YStack>
      ) : (
        <>
          <Spinner />
          <Paragraph ta="center" color="$grey-600">
            <Trans
              id="mdlFlow.inProgress"
              comment="Shown while the license is verified against the RTAD registry and issued"
            >
              Verifying your license with the road transport department…
            </Trans>
          </Paragraph>
        </>
      )}
    </Page>
  )
}
