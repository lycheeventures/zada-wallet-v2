import { Trans, useLingui } from '@lingui/react/macro'
import { Button, Input, Paragraph, YStack } from '@package/ui'
import { useEffect, useState } from 'react'
import type { OtpChannel } from './usherApi'

interface CodeStepProps {
  /** Where the code went (masked phone or the email address). */
  destination: string
  kind: 'phone' | 'email'
  busy: boolean
  /** The last submit error — a new one clears the typed code so the user can retry at once. */
  error?: string | null
  /** Present only when the provider runs in demo mode (no real message was sent). */
  devCode?: string
  /** Seconds until another code may be requested (mirrors the server cooldown). */
  resendAvailableAt: number
  onSubmit: (code: string) => void
  onResend: (channel?: OtpChannel) => void
}

export function CodeStep({
  destination,
  kind,
  busy,
  error,
  devCode,
  resendAvailableAt,
  onSubmit,
  onResend,
}: CodeStepProps) {
  const { t } = useLingui()
  const [code, setCode] = useState('')
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  // Submit as soon as the sixth digit lands — the code is the whole input.
  useEffect(() => {
    if (code.length === 6 && !busy) onSubmit(code)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code])

  useEffect(() => {
    if (error) setCode('')
  }, [error])

  const waitSeconds = Math.max(0, Math.ceil((resendAvailableAt - now) / 1000))
  const canResend = waitSeconds === 0 && !busy

  return (
    <YStack gap="$4">
      <Paragraph variant="sub" color="$grey-600">
        <Trans id="zadaId.code.sentTo">We sent a 6-digit code to {destination}.</Trans>
      </Paragraph>
      <Input
        value={code}
        onChangeText={(v) => setCode(v.replace(/\D+/g, '').slice(0, 6))}
        keyboardType="number-pad"
        autoComplete={kind === 'phone' ? 'sms-otp' : 'one-time-code'}
        textContentType="oneTimeCode"
        maxLength={6}
        autoFocus
        editable={!busy}
        style={{ fontSize: 28, letterSpacing: 10, textAlign: 'center' }}
        placeholder="••••••"
      />
      {devCode ? (
        <Paragraph variant="sub" color="$warning-500" ta="center">
          <Trans id="zadaId.code.devCode">Demo mode — your code is {devCode}.</Trans>
        </Paragraph>
      ) : null}
      <YStack gap="$1" ai="center">
        {canResend ? (
          <>
            <Button.Text onPress={() => onResend(kind === 'phone' ? 'sms' : undefined)}>
              {kind === 'phone'
                ? t({ id: 'zadaId.code.resendSms', message: 'Resend SMS' })
                : t({ id: 'zadaId.code.resendEmail', message: 'Resend email' })}
            </Button.Text>
            {kind === 'phone' ? (
              <Button.Text onPress={() => onResend('whatsapp')}>
                {t({ id: 'zadaId.code.sendWhatsapp', message: 'Send it via WhatsApp instead' })}
              </Button.Text>
            ) : null}
          </>
        ) : (
          <Paragraph variant="sub" color="$grey-500" ta="center">
            <Trans id="zadaId.code.resendIn">Didn't get it? You can request another code in {waitSeconds}s.</Trans>
          </Paragraph>
        )}
      </YStack>
    </YStack>
  )
}
