import { useLingui } from '@lingui/react/macro'
import { Heading, HeroIcons, IconContainer, Input, Paragraph, XStack, YStack } from '@package/ui'
import { useMemo, useState } from 'react'
import { FlatList, Modal, Pressable } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { COUNTRIES, type Country, findCountry } from './phone'

interface CountryPickerProps {
  /** ISO alpha-2 */
  value: string
  onChange: (code: string) => void
}

/** Dial-code picker: a compact button that opens a searchable full-screen list. */
export function CountryPicker({ value, onChange }: CountryPickerProps) {
  const { t } = useLingui()
  const insets = useSafeAreaInsets()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const selected = findCountry(value)

  const list = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return COUNTRIES
    const digits = q.replace(/^\+/, '')
    return COUNTRIES.filter(
      (c) => c.name.toLowerCase().includes(q) || c.code.toLowerCase() === q || (digits && c.dial.startsWith(digits))
    )
  }, [query])

  const close = () => {
    setOpen(false)
    setQuery('')
  }

  const renderItem = ({ item }: { item: Country }) => (
    <Pressable
      onPress={() => {
        onChange(item.code)
        close()
      }}
      accessibilityRole="button"
    >
      <XStack ai="center" gap="$3" px="$4" py="$3" bg={item.code === value ? '$primary-100' : undefined}>
        <Paragraph fontSize={22}>{item.flag}</Paragraph>
        <Paragraph f={1} numberOfLines={1}>
          {item.name}
        </Paragraph>
        <Paragraph color="$grey-600">+{item.dial}</Paragraph>
      </XStack>
    </Pressable>
  )

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={t({ id: 'zadaId.phone.selectCountry', message: 'Select country' })}
      >
        <XStack ai="center" gap="$2" h={52} px="$3" br="$4" bg="$grey-100" borderWidth={1} borderColor="$grey-300">
          <Paragraph fontSize={20}>{selected.flag}</Paragraph>
          <Paragraph fontWeight="$semiBold">+{selected.dial}</Paragraph>
          <HeroIcons.ChevronDown size={16} color="$grey-500" />
        </XStack>
      </Pressable>

      <Modal visible={open} animationType="slide" onRequestClose={close}>
        <YStack f={1} bg="$background" pt={insets.top + 8} pb={insets.bottom}>
          <XStack ai="center" jc="space-between" px="$4" h={44}>
            <Heading heading="h3">{t({ id: 'zadaId.phone.countryTitle', message: 'Country' })}</Heading>
            <IconContainer
              aria-label={t({ id: 'zadaId.close', message: 'Close' })}
              icon={<HeroIcons.X />}
              onPress={close}
            />
          </XStack>
          <YStack px="$4" py="$2">
            <Input
              value={query}
              onChangeText={setQuery}
              placeholder={t({ id: 'zadaId.phone.searchCountry', message: 'Search country or code' })}
              autoFocus
              autoCapitalize="none"
            />
          </YStack>
          <FlatList
            data={list}
            keyExtractor={(c) => c.code}
            renderItem={renderItem}
            keyboardShouldPersistTaps="handled"
            initialNumToRender={20}
          />
        </YStack>
      </Modal>
    </>
  )
}
