import { useLingui } from '@lingui/react/macro'
import { Button, Input, Paragraph, XStack, YStack } from '@package/ui'
import { useState } from 'react'
import { CountryPicker } from './CountryPicker'
import { DEFAULT_COUNTRY, findCountry, isValidE164, splitDefault, toE164 } from './phone'
import type { OtpChannel } from './usherApi'

interface PhoneStepProps {
  initialPhone?: string
  busy: boolean
  onSubmit: (phone: string, channel: OtpChannel) => void
}

export function PhoneStep({ initialPhone, busy, onSubmit }: PhoneStepProps) {
  const { t } = useLingui()
  const initial = splitDefault(initialPhone)
  const [country, setCountry] = useState(initial.country || DEFAULT_COUNTRY)
  const [national, setNational] = useState(initial.national)

  const phone = toE164(findCountry(country).dial, national)
  const canContinue = isValidE164(phone) && !busy

  return (
    <YStack gap="$4">
      <YStack gap="$1.5">
        <Paragraph variant="sub">{t({ id: 'zadaId.phone.label', message: 'Phone number' })}</Paragraph>
        <XStack gap="$2" ai="center">
          <CountryPicker value={country} onChange={setCountry} />
          <Input
            f={1}
            value={national}
            onChangeText={setNational}
            keyboardType="phone-pad"
            autoComplete="tel-national"
            textContentType="telephoneNumber"
            placeholder={t({ id: 'zadaId.phone.placeholder', message: 'Mobile number' })}
            autoFocus
            editable={!busy}
            onSubmitEditing={() => canContinue && onSubmit(phone, 'sms')}
          />
        </XStack>
        {national.length > 0 && !isValidE164(phone) ? (
          <Paragraph variant="sub" color="$grey-500">
            {t({ id: 'zadaId.phone.hint', message: 'Enter the number without the leading 0.' })}
          </Paragraph>
        ) : null}
      </YStack>
      <Button.Solid onPress={() => onSubmit(phone, 'sms')} disabled={!canContinue} opacity={canContinue ? 1 : 0.5}>
        {t({ id: 'zadaId.phone.sendCode', message: 'Send code by SMS' })}
      </Button.Solid>
      <Button.Outline
        onPress={() => onSubmit(phone, 'whatsapp')}
        disabled={!canContinue}
        opacity={canContinue ? 1 : 0.5}
      >
        {t({ id: 'zadaId.phone.sendWhatsapp', message: 'Send code via WhatsApp' })}
      </Button.Outline>
    </YStack>
  )
}
