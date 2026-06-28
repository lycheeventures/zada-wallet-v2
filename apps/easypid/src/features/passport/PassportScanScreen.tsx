import { Trans, useLingui } from '@lingui/react/macro'
import { commonMessages } from '@package/translations'
import { Button, Heading, HeroIcons, Input, Page, Paragraph, ScrollView, Spinner, XStack, YStack } from '@package/ui'
import { Camera, CameraView } from 'expo-camera'
import * as ImageManipulator from 'expo-image-manipulator'
import { useRouter } from 'expo-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Linking, StyleSheet } from 'react-native'
import { SystemBars } from 'react-native-edge-to-edge'
import { type MrzData, ocrMrzFromImage } from './mrz'

type Mode = 'scanning' | 'processing' | 'confirm' | 'manual'

interface PassportScanScreenProps {
  /** Called once an MRZ is captured/confirmed. P3 will continue to the NFC chip read with these. */
  onMrzScanned: (mrz: MrzData) => void
}

export function PassportScanScreen({ onMrzScanned }: PassportScanScreenProps) {
  const { back } = useRouter()
  const { t } = useLingui()
  const cameraRef = useRef<CameraView>(null)
  const [hasPermission, setHasPermission] = useState<boolean>()
  const [mode, setMode] = useState<Mode>('scanning')
  const [mrz, setMrz] = useState<MrzData | null>(null)
  const [helpText, setHelpText] = useState('')

  useEffect(() => {
    void Camera.requestCameraPermissionsAsync().then(({ status }) => setHasPermission(status === 'granted'))
  }, [])

  const onCapture = useCallback(async () => {
    if (!cameraRef.current) return
    setMode('processing')
    setHelpText('')
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.9, skipProcessing: false })
      if (!photo?.uri) throw new Error('no image')
      // Crop to the bottom ~40% where the MRZ sits — sharpens OCR and drops the rest of the page.
      const cropped = await ImageManipulator.manipulateAsync(
        photo.uri,
        [{ crop: { originX: 0, originY: photo.height * 0.6, width: photo.width, height: photo.height * 0.4 } }],
        { compress: 1, format: ImageManipulator.SaveFormat.JPEG }
      ).catch(() => null)
      const parsed = await ocrMrzFromImage(cropped?.uri ?? photo.uri)
      if (!parsed) {
        setHelpText(
          t({
            id: 'passportScan.notFound',
            message: 'Could not read the MRZ. Align the two bottom lines and try again.',
          })
        )
        setMode('scanning')
        return
      }
      setMrz(parsed)
      setMode('confirm')
    } catch {
      setHelpText(
        t({ id: 'passportScan.captureError', message: 'Capture failed. Try again or enter the details manually.' })
      )
      setMode('scanning')
    }
  }, [t])

  if (hasPermission === false) {
    return (
      <Page justifyContent="center" alignItems="center" gap="$2">
        <Heading heading="h2">
          <Trans id="passportScan.permissionHeading" comment="Camera permission heading for passport scan">
            Please allow camera access
          </Trans>
        </Heading>
        <Paragraph textAlign="center">
          <Trans id="passportScan.permissionDescription" comment="Why camera is needed for passport scan">
            This lets the app read the printed code at the bottom of your passport.
          </Trans>
        </Paragraph>
        <Button.Text onPress={() => void Linking.openSettings()}>{t(commonMessages.openSettingsButton)}</Button.Text>
      </Page>
    )
  }

  // Confirm / manual-entry views share a simple form layout.
  if (mode === 'confirm' || mode === 'manual') {
    return (
      <PassportMrzReview
        mode={mode}
        mrz={mrz}
        onRescan={() => {
          setMrz(null)
          setMode('scanning')
        }}
        onConfirm={onMrzScanned}
      />
    )
  }

  return (
    <Page f={1} fd="column" jc="space-between" bg="$black">
      <SystemBars style="light" />
      {hasPermission && <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} autofocus="on" />}

      <YStack zi="$5" ai="center" py="$8" gap="$2">
        <Heading heading="h2" dark ta="center" maxWidth="80%">
          <Trans id="passportScan.instructionHeading" comment="Instruction to scan passport MRZ">
            Scan the bottom of your passport
          </Trans>
        </Heading>
        <Paragraph dark ta="center" maxWidth="80%">
          <Trans id="passportScan.instructionBody" comment="Help text for aligning the MRZ">
            Place the two lines of code at the bottom of the photo page inside the frame.
          </Trans>
        </Paragraph>
        {helpText ? (
          <XStack bg="$warning-500" br="$12" px="$3" py="$1.5" gap="$2" ai="center" mt="$2">
            <HeroIcons.ExclamationTriangleFilled size={16} color="$grey-900" />
            <Paragraph color="$grey-900" variant="caption">
              {helpText}
            </Paragraph>
          </XStack>
        ) : null}
      </YStack>

      {/* MRZ guide band */}
      <YStack pos="absolute" l="$4" r="$4" t="50%" h={110} br="$4" borderWidth={2} borderColor="$white" opacity={0.7} />

      <YStack zi="$5" ai="center" gap="$3" pb="$2">
        {mode === 'processing' ? (
          <Spinner variant="dark" />
        ) : (
          <Button.Solid bg="$grey-100" color="$grey-900" br="$12" px="$6" onPress={() => void onCapture()} scaleOnPress>
            <Trans id="passportScan.captureButton" comment="Button to capture the MRZ">
              Capture
            </Trans>
          </Button.Solid>
        )}
        <Button.Text color="$white" onPress={() => setMode('manual')}>
          <Trans id="passportScan.enterManually" comment="Fallback to type the passport details">
            Enter details manually
          </Trans>
        </Button.Text>
        <Button.Text color="$grey-400" onPress={() => back()}>
          {t(commonMessages.cancel)}
        </Button.Text>
      </YStack>
    </Page>
  )
}

interface ReviewProps {
  mode: 'confirm' | 'manual'
  mrz: MrzData | null
  onRescan: () => void
  onConfirm: (mrz: MrzData) => void
}

// Shows the parsed MRZ for confirmation, or a manual-entry form for the three BAC/PACE key fields.
function PassportMrzReview({ mode, mrz, onRescan, onConfirm }: ReviewProps) {
  const { t } = useLingui()
  const [documentNumber, setDocumentNumber] = useState(mrz?.documentNumber ?? '')
  const [dateOfBirth, setDateOfBirth] = useState(mrz?.dateOfBirth ?? '')
  const [dateOfExpiry, setDateOfExpiry] = useState(mrz?.dateOfExpiry ?? '')

  const isManual = mode === 'manual'
  const canContinue = documentNumber.length >= 5 && /^\d{6}$/.test(dateOfBirth) && /^\d{6}$/.test(dateOfExpiry)

  const handleContinue = () => {
    if (mrz && !isManual) return onConfirm(mrz)
    // Manual: the three key fields are enough to unlock the chip; P3 reads the rest off DG1.
    onConfirm({ documentNumber, dateOfBirth, dateOfExpiry, rawMrz: '', valid: false })
  }

  return (
    <Page>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
        <Heading heading="h2">
          {isManual ? (
            <Trans id="passportScan.manualHeading" comment="Manual passport entry heading">
              Enter passport details
            </Trans>
          ) : (
            <Trans id="passportScan.confirmHeading" comment="Confirm scanned passport heading">
              Confirm passport details
            </Trans>
          )}
        </Heading>

        {!isManual && mrz && !mrz.valid ? (
          <XStack bg="$warning-100" br="$4" p="$3" gap="$2" ai="center">
            <HeroIcons.ExclamationTriangleFilled size={18} color="$warning-700" />
            <Paragraph variant="caption" color="$warning-700" f={1}>
              <Trans id="passportScan.checkDigitWarning" comment="Warn that MRZ check digits failed">
                Some characters may be misread. Please check the fields below before continuing.
              </Trans>
            </Paragraph>
          </XStack>
        ) : null}

        <Paragraph variant="sub" color="$grey-600">
          <Trans id="passportScan.keyFieldsLabel" comment="Label explaining these three fields unlock the chip">
            These three fields unlock the passport chip.
          </Trans>
        </Paragraph>

        <YStack gap="$3">
          <LabeledInput
            label={t({ id: 'passportScan.documentNumber', message: 'Passport number' })}
            value={documentNumber}
            onChangeText={setDocumentNumber}
            autoCapitalize="characters"
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

        {mrz?.lastName || mrz?.firstName ? (
          <Paragraph variant="sub" color="$grey-600">
            {mrz?.firstName} {mrz?.lastName} · {mrz?.nationality}
          </Paragraph>
        ) : null}

        <YStack gap="$2" pt="$2">
          <Button.Solid onPress={handleContinue} disabled={!canContinue} opacity={canContinue ? 1 : 0.5}>
            <Trans id="passportScan.continueToChip" comment="Continue to NFC chip read">
              Continue — read chip
            </Trans>
          </Button.Solid>
          {!isManual ? (
            <Button.Text onPress={onRescan}>
              <Trans id="passportScan.rescan" comment="Rescan the MRZ">
                Scan again
              </Trans>
            </Button.Text>
          ) : (
            <Button.Text onPress={onRescan}>
              <Trans id="passportScan.useCamera" comment="Switch from manual entry back to camera">
                Use the camera instead
              </Trans>
            </Button.Text>
          )}
        </YStack>
      </ScrollView>
    </Page>
  )
}

function LabeledInput({ label, ...props }: { label: string } & React.ComponentProps<typeof Input>) {
  return (
    <YStack gap="$1.5">
      <Paragraph variant="sub">{label}</Paragraph>
      <Input {...props} />
    </YStack>
  )
}
