import { useLingui } from '@lingui/react/macro'
import { Button, Input, Paragraph, YStack } from '@package/ui'
import { useState } from 'react'
import { looksLikeEmail } from './phone'

interface EmailStepProps {
  initialEmail?: string
  busy: boolean
  onSubmit: (email: string) => void
}

export function EmailStep({ initialEmail, busy, onSubmit }: EmailStepProps) {
  const { t } = useLingui()
  const [email, setEmail] = useState(initialEmail ?? '')
  const canContinue = looksLikeEmail(email) && !busy
  const submit = () => canContinue && onSubmit(email.trim().toLowerCase())

  return (
    <YStack gap="$4">
      <YStack gap="$1.5">
        <Paragraph variant="sub">{t({ id: 'zadaId.email.label', message: 'Email address' })}</Paragraph>
        <Input
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoComplete="email"
          textContentType="emailAddress"
          autoCapitalize="none"
          placeholder="you@example.com"
          autoFocus
          editable={!busy}
          onSubmitEditing={submit}
        />
      </YStack>
      <Button.Solid onPress={submit} disabled={!canContinue} opacity={canContinue ? 1 : 0.5}>
        {t({ id: 'zadaId.email.sendCode', message: 'Send code' })}
      </Button.Solid>
    </YStack>
  )
}
