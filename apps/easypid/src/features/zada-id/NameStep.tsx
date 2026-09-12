import { useLingui } from '@lingui/react/macro'
import { Button, Input, Paragraph, YStack } from '@package/ui'
import { useState } from 'react'

interface NameStepProps {
  initialName?: string
  busy: boolean
  onSubmit: (name: string) => void
}

export function NameStep({ initialName, busy, onSubmit }: NameStepProps) {
  const { t } = useLingui()
  const [name, setName] = useState(initialName ?? '')
  const trimmed = name.trim().replace(/\s+/g, ' ')
  const canContinue = trimmed.length >= 2 && trimmed.length <= 200 && !busy
  const submit = () => canContinue && onSubmit(trimmed)

  return (
    <YStack gap="$4">
      <YStack gap="$1.5">
        <Paragraph variant="sub">{t({ id: 'zadaId.name.label', message: 'Full name' })}</Paragraph>
        <Input
          value={name}
          onChangeText={setName}
          autoComplete="name"
          textContentType="name"
          autoCapitalize="words"
          placeholder={t({ id: 'zadaId.name.placeholder', message: 'As written on your ID' })}
          autoFocus
          editable={!busy}
          onSubmitEditing={submit}
        />
      </YStack>
      <Button.Solid onPress={submit} disabled={!canContinue} opacity={canContinue ? 1 : 0.5}>
        {t({ id: 'zadaId.name.continue', message: 'Continue' })}
      </Button.Solid>
    </YStack>
  )
}
