import { Trans, useLingui } from '@lingui/react/macro'
import { commonMessages } from '@package/translations'
import { Button, Heading, Input, Page, Paragraph, ScrollView, YStack } from '@package/ui'
import { useRouter } from 'expo-router'
import type { ComponentProps } from 'react'
import { useState } from 'react'
import type { MrzData } from './mrz'

interface PassportScanScreenProps {
  /** Called once the MRZ key fields are entered. P3 continues to the NFC chip read with these. */
  onMrzScanned: (mrz: MrzData) => void
}

/**
 * Passport import (P2) — manual entry of the three MRZ key fields (document number, date of birth,
 * date of expiry) that derive the eMRTD chip's BAC/PACE access key. P3 then reads the rest off DG1.
 *
 * There is deliberately no camera/OCR step: on-device OCR (ML Kit text recognition) was
 * non-functional on the New Architecture and its native library was not 16 KB-page-aligned, which
 * blocked Google Play releases. Typing the three short fields is fast and reliable, so this screen
 * opens straight on the form.
 */
export function PassportScanScreen({ onMrzScanned }: PassportScanScreenProps) {
  const { back } = useRouter()
  const { t } = useLingui()
  const [documentNumber, setDocumentNumber] = useState('')
  const [dateOfBirth, setDateOfBirth] = useState('')
  const [dateOfExpiry, setDateOfExpiry] = useState('')

  const canContinue = documentNumber.length >= 5 && /^\d{6}$/.test(dateOfBirth) && /^\d{6}$/.test(dateOfExpiry)

  const handleContinue = () => {
    // The three key fields are enough to unlock the chip; P3 reads name/nationality/etc. off DG1.
    onMrzScanned({ documentNumber, dateOfBirth, dateOfExpiry, rawMrz: '', valid: false })
  }

  return (
    <Page>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }} keyboardShouldPersistTaps="handled">
        <Heading heading="h2">
          <Trans id="passportScan.manualHeading" comment="Manual passport entry heading">
            Enter passport details
          </Trans>
        </Heading>

        <Paragraph variant="sub" color="$grey-600">
          <Trans id="passportScan.manualIntro" comment="Explains where to find the passport key fields and why">
            Find these on the photo page of your passport. They unlock the passport's chip so it can be read securely.
          </Trans>
        </Paragraph>

        <YStack gap="$3">
          <LabeledInput
            label={t({ id: 'passportScan.documentNumber', message: 'Passport number' })}
            value={documentNumber}
            onChangeText={setDocumentNumber}
            autoCapitalize="characters"
            autoFocus
          />
          <LabeledInput
            label={t({ id: 'passportScan.dateOfBirth', message: 'Date of birth (YYMMDD)' })}
            value={dateOfBirth}
            onChangeText={setDateOfBirth}
            keyboardType="number-pad"
            maxLength={6}
          />
          <LabeledInput
            label={t({ id: 'passportScan.dateOfExpiry', message: 'Expiry date (YYMMDD)' })}
            value={dateOfExpiry}
            onChangeText={setDateOfExpiry}
            keyboardType="number-pad"
            maxLength={6}
          />
        </YStack>

        <YStack gap="$2" pt="$2">
          <Button.Solid onPress={handleContinue} disabled={!canContinue} opacity={canContinue ? 1 : 0.5}>
            {t({ id: 'passportScan.continueToChip', message: 'Continue — read chip' })}
          </Button.Solid>
          <Button.Text onPress={() => back()}>{t(commonMessages.cancel)}</Button.Text>
        </YStack>
      </ScrollView>
    </Page>
  )
}

function LabeledInput({ label, ...props }: { label: string } & ComponentProps<typeof Input>) {
  return (
    <YStack gap="$1.5">
      <Paragraph variant="sub">{label}</Paragraph>
      <Input {...props} />
    </YStack>
  )
}
