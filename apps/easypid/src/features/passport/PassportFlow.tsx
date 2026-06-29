import { Trans, useLingui } from '@lingui/react/macro'
import { type CredentialDataHandlerOptions, useCredentialDataHandler } from '@package/app'
import { Button, Heading, Page, Paragraph, Spinner, YStack } from '@package/ui'
import { useState } from 'react'
import type { PassportReadResult } from '../../../modules/passport-nfc'
import { issuePassportCredential, issuePassportFromMrz } from './issuePassport'
import type { MrzData } from './mrz'
import { PassportNfcReadScreen } from './PassportNfcReadScreen'
import { PassportScanScreen } from './PassportScanScreen'

type Step = 'mrz' | 'nfc' | 'issuing'

// Coordinates the full passport import: OCR MRZ (P2) → NFC chip read (P3) → issue via Hovi and
// receive on the normal credential rail (P4). State is held here so we don't serialize the (large,
// PII) passport data through router params.
export function PassportFlow({
  credentialDataHandlerOptions,
}: {
  credentialDataHandlerOptions?: CredentialDataHandlerOptions
}) {
  const { t } = useLingui()
  const [step, setStep] = useState<Step>('mrz')
  const [mrz, setMrz] = useState<MrzData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const { handleCredentialData } = useCredentialDataHandler()

  const deliver = async (getOfferUri: () => Promise<string>) => {
    setStep('issuing')
    setError(null)
    try {
      const offerUri = await getOfferUri()
      const result = await handleCredentialData(offerUri, credentialDataHandlerOptions)
      if (!result.success) setError(result.message ?? 'Could not load the credential offer.')
      // On success, handleCredentialData routes to the credential-receipt screen; this modal unwinds.
    } catch (e) {
      setError((e as Error)?.message ?? 'Issuance failed.')
    }
  }

  const issue = (passport: PassportReadResult, mrzData: MrzData) =>
    deliver(() => issuePassportCredential(passport, mrzData))
  // Fallback when the NFC reader isn't available: issue from the MRZ alone (chip_authenticated:false).
  const issueWithoutChip = (mrzData: MrzData) => deliver(() => issuePassportFromMrz(mrzData))

  if (step === 'mrz') {
    return (
      <PassportScanScreen
        onMrzScanned={(m) => {
          setMrz(m)
          setStep('nfc')
        }}
      />
    )
  }

  if (step === 'nfc' && mrz) {
    return (
      <PassportNfcReadScreen
        mrz={mrz}
        onComplete={(p) => void issue(p, mrz)}
        onSkipChip={() => void issueWithoutChip(mrz)}
        onCancel={() => setStep('mrz')}
      />
    )
  }

  return (
    <Page f={1} jc="center" ai="center" gap="$4" p="$4">
      <Heading heading="h2" ta="center">
        <Trans id="passportIssue.heading" comment="Heading while issuing the passport credential">
          Adding your passport
        </Trans>
      </Heading>
      {error ? (
        <YStack gap="$3" w="100%" ai="center">
          <Paragraph ta="center" color="$danger-500">
            {error}
          </Paragraph>
          <Button.Solid onPress={() => mrz && setStep('nfc')}>
            {t({ id: 'passportIssue.retry', message: 'Try again' })}
          </Button.Solid>
        </YStack>
      ) : (
        <>
          <Spinner />
          <Paragraph ta="center" color="$grey-600">
            <Trans id="passportIssue.inProgress" comment="Shown while issuing the passport credential">
              Creating your passport credential…
            </Trans>
          </Paragraph>
        </>
      )}
    </Page>
  )
}
