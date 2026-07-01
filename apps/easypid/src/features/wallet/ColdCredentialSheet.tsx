import { getColdCredential } from '@easypid/hooks/useShareCredential'
import { useLingui } from '@lingui/react/macro'
import type { CredentialForDisplay } from '@package/agent/display'
import { Button, FloatingSheet, Heading, Loader, Paragraph, Stack, YStack } from '@package/ui'
import * as Sharing from 'expo-sharing'
import { useEffect, useState } from 'react'
import { useWindowDimensions } from 'react-native'
import QRCode from 'react-native-qrcode-svg'

interface ColdCredentialSheetProps {
  isOpen: boolean
  setIsOpen: (open: boolean) => void
  credential?: CredentialForDisplay
}

// Bottom sheet showing the offline copy of a credential: an on-screen QR a verifier can scan, and a
// button to share the PDF. Both come from trust-bound-roots' /api/v1/request-cold (cached on-device).
export function ColdCredentialSheet({ isOpen, setIsOpen, credential }: ColdCredentialSheetProps) {
  const { t } = useLingui()
  const { width } = useWindowDimensions()
  const [loading, setLoading] = useState(false)
  const [zada, setZada] = useState<string>()
  const [path, setPath] = useState<string>()
  const [error, setError] = useState<string>()

  const load = async (forceRefresh = false) => {
    if (!credential) return
    setLoading(true)
    setError(undefined)
    const r = await getColdCredential(credential, { forceRefresh })
    setLoading(false)
    if (r.error) {
      setError(
        r.error === 'offline'
          ? t({ id: 'credentials.cold.offline', message: 'You’re offline. Connect once to create your offline copy.' })
          : r.error === 'untrusted'
            ? t({ id: 'credentials.cold.untrusted', message: 'This issuer isn’t recognised for offline copies yet.' })
            : t({ id: 'credentials.cold.failed', message: 'Couldn’t create the offline copy. Please try again.' })
      )
      return
    }
    setZada(r.zada)
    setPath(r.path)
  }

  // Load (or read the cached copy) when the sheet opens.
  useEffect(() => {
    if (isOpen) void load(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, credential?.id])

  const sharePdf = async () => {
    if (path) await Sharing.shareAsync(path)
  }

  const qrSize = Math.min(width * 0.62, 260)

  return (
    <FloatingSheet isOpen={isOpen} setIsOpen={setIsOpen}>
      <YStack p="$4" gap="$4" ai="center">
        <Heading heading="h2" ta="center">
          {t({ id: 'credentials.cold.title', message: 'Offline copy' })}
        </Heading>

        {loading ? (
          <Stack h={qrSize} jc="center" ai="center">
            <Loader />
          </Stack>
        ) : error ? (
          <YStack gap="$3" ai="center">
            <Paragraph ta="center" color="$grey-600">
              {error}
            </Paragraph>
            <Button.Text onPress={() => load(true)}>{t({ id: 'credentials.cold.retry', message: 'Try again' })}</Button.Text>
          </YStack>
        ) : (
          <>
            {zada ? (
              <>
                <Stack bg="$white" br="$8" p="$4">
                  <QRCode size={qrSize} value={zada} ecl="H" />
                </Stack>
                <Paragraph ta="center" color="$grey-600" fontSize={14}>
                  {t({
                    id: 'credentials.cold.qrHint',
                    message: 'A verifier can scan this QR to check it — even offline. Or share it as a PDF.',
                  })}
                </Paragraph>
              </>
            ) : (
              <Paragraph ta="center" color="$grey-600">
                {t({ id: 'credentials.cold.pdfOnly', message: 'A PDF copy of this credential.' })}
              </Paragraph>
            )}

            <YStack w="100%" gap="$2">
              <Button.Solid onPress={sharePdf}>{t({ id: 'credentials.cold.sharePdf', message: 'Share PDF' })}</Button.Solid>
              <Button.Text onPress={() => load(true)}>
                {t({ id: 'credentials.cold.regenerate', message: 'Regenerate' })}
              </Button.Text>
            </YStack>
          </>
        )}
      </YStack>
    </FloatingSheet>
  )
}
