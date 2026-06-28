import { Trans } from '@lingui/react/macro'
import { Button, Heading, HeroIcons, Page, Paragraph, Spinner, YStack } from '@package/ui'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  addPassportStatusListener,
  cancelPassportRead,
  isNfcAvailable,
  isPassportReaderAvailable,
  type PassportNfcStatus,
  type PassportReadResult,
  readPassport,
} from '../../../modules/passport-nfc'
import type { MrzData } from './mrz'

interface PassportNfcReadScreenProps {
  mrz: MrzData
  onComplete: (passport: PassportReadResult) => void
  onCancel: () => void
}

const statusCopy: Record<PassportNfcStatus, string> = {
  waiting_for_tag: 'Hold your passport against the top of your phone',
  tag_detected: 'Passport detected — keep it still',
  authenticating: 'Unlocking the chip…',
  reading_dg1: 'Reading passport data…',
  reading_dg2: 'Reading photo…',
  verifying: 'Verifying chip signature…',
  done: 'Done',
}

export function PassportNfcReadScreen({ mrz, onComplete, onCancel }: PassportNfcReadScreenProps) {
  const [status, setStatus] = useState<PassportNfcStatus>('waiting_for_tag')
  const [error, setError] = useState<string | null>(null)
  const [reading, setReading] = useState(false)
  const startedRef = useRef(false)

  const start = useCallback(async () => {
    setError(null)
    setStatus('waiting_for_tag')
    setReading(true)
    try {
      if (!isPassportReaderAvailable()) {
        setError("Passport reader isn't included in this build (native module not linked). Rebuild required.")
        setReading(false)
        return
      }
      if (!(await isNfcAvailable())) {
        setError('NFC is turned off or not supported on this device.')
        setReading(false)
        return
      }
      const result = await readPassport({
        documentNumber: mrz.documentNumber,
        dateOfBirth: mrz.dateOfBirth,
        dateOfExpiry: mrz.dateOfExpiry,
      })
      onComplete(result)
    } catch (e) {
      const code = (e as { code?: string })?.code
      setError(
        code === 'AUTH_FAILED'
          ? "Couldn't unlock the chip — the passport number, date of birth or expiry may be wrong. Go back and re-check."
          : ((e as Error)?.message ?? 'Failed to read the passport chip.')
      )
      setReading(false)
    }
  }, [mrz, onComplete])

  useEffect(() => {
    const sub = addPassportStatusListener(setStatus)
    if (!startedRef.current) {
      startedRef.current = true
      void start()
    }
    return () => {
      sub.remove()
      void cancelPassportRead()
    }
  }, [start])

  return (
    <Page f={1} jc="center" ai="center" gap="$4" p="$4">
      <HeroIcons.DevicePhoneMobile size={56} color="$primary-500" />
      <Heading heading="h2" ta="center">
        <Trans id="passportNfc.heading" comment="Heading for the passport NFC read step">
          Read passport chip
        </Trans>
      </Heading>

      {error ? (
        <>
          <Paragraph ta="center" color="$danger-500">
            {error}
          </Paragraph>
          <YStack gap="$2" w="100%">
            <Button.Solid onPress={() => void start()}>
              <Trans id="passportNfc.retry" comment="Retry the chip read">
                Try again
              </Trans>
            </Button.Solid>
            <Button.Text onPress={onCancel}>
              <Trans id="passportNfc.back" comment="Go back to the MRZ step">
                Back
              </Trans>
            </Button.Text>
          </YStack>
        </>
      ) : (
        <>
          {reading ? <Spinner /> : null}
          <Paragraph ta="center" color="$grey-600">
            {statusCopy[status]}
          </Paragraph>
          <Button.Text onPress={onCancel}>
            <Trans id="passportNfc.cancel" comment="Cancel the chip read">
              Cancel
            </Trans>
          </Button.Text>
        </>
      )}
    </Page>
  )
}
