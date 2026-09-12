import { useLingui } from '@lingui/react/macro'
import {
  Heading,
  HeroIcons,
  IconContainer,
  Page,
  Paragraph,
  ProgressBar,
  ScrollView,
  XStack,
  YStack,
} from '@package/ui'
import type { ReactNode } from 'react'
import { KeyboardAvoidingView, Platform } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

interface FlowShellProps {
  title: string
  subtitle?: string
  /** 0–100 */
  progress: number
  onBack?: () => void
  onClose?: () => void
  children: ReactNode
  /** Pinned under the scrollable content (primary/secondary buttons). */
  footer?: ReactNode
}

/**
 * Common frame for every step of the ZADA ID flow: back / close, a progress bar, heading and
 * subtitle, scrollable content and a pinned footer. Mirrors the web flow's card so the two
 * feel like the same product.
 */
export function FlowShell({ title, subtitle, progress, onBack, onClose, children, footer }: FlowShellProps) {
  const { t } = useLingui()
  const insets = useSafeAreaInsets()

  return (
    <Page>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
        <YStack f={1} px="$4" pt={Platform.OS === 'ios' ? '$3' : insets.top + 8} pb={Math.max(insets.bottom, 16)}>
          <XStack jc="space-between" ai="center" h={44}>
            {onBack ? (
              <IconContainer
                aria-label={t({ id: 'zadaId.back', message: 'Back' })}
                icon={<HeroIcons.ArrowLeft />}
                onPress={onBack}
              />
            ) : (
              <YStack w={44} />
            )}
            {onClose ? (
              <IconContainer
                aria-label={t({ id: 'zadaId.close', message: 'Close' })}
                icon={<HeroIcons.X />}
                onPress={onClose}
              />
            ) : (
              <YStack w={44} />
            )}
          </XStack>

          <YStack py="$3">
            <ProgressBar value={progress} />
          </YStack>

          <ScrollView
            contentContainerStyle={{ flexGrow: 1, gap: 16, paddingBottom: 16 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <YStack gap="$2">
              <Heading heading="h2">{title}</Heading>
              {subtitle ? (
                <Paragraph variant="sub" color="$grey-600">
                  {subtitle}
                </Paragraph>
              ) : null}
            </YStack>
            {children}
          </ScrollView>

          {footer ? (
            <YStack gap="$2" pt="$3">
              {footer}
            </YStack>
          ) : null}
        </YStack>
      </KeyboardAvoidingView>
    </Page>
  )
}
