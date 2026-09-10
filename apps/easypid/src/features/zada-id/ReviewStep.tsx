import { Trans, useLingui } from '@lingui/react/macro'
import { Button, Circle, Heading, HeroIcons, Paragraph, Spinner, XStack, YStack } from '@package/ui'
import { Pressable } from 'react-native'
import type { DiscoveredCredential, ZadaIdFlowState } from './flowState'
import { formatE164 } from './phone'

interface ReviewStepProps {
  state: ZadaIdFlowState
  /** Legacy-credential discovery still running in the background. */
  discovering: boolean
  discoveryNote?: string
  notifyStatus: 'idle' | 'busy' | 'done'
  busy: boolean
  onToggle: (id: string) => void
  onNotify: () => void
  onAdd: () => void
}

function Row({
  title,
  subtitle,
  selected,
  locked,
  onPress,
}: {
  title: string
  subtitle?: string
  selected: boolean
  locked?: boolean
  onPress?: () => void
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={locked || !onPress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
    >
      <XStack
        ai="center"
        gap="$3"
        p="$3"
        br="$5"
        bg="$grey-100"
        borderWidth={1}
        borderColor={selected ? '$primary-300' : '$grey-200'}
      >
        <YStack f={1} gap="$0.5">
          <Paragraph fontWeight="$semiBold" numberOfLines={1}>
            {title}
          </Paragraph>
          {subtitle ? (
            <Paragraph variant="sub" color="$grey-600" numberOfLines={2}>
              {subtitle}
            </Paragraph>
          ) : null}
        </YStack>
        {selected ? (
          <HeroIcons.CheckCircleFilled color={locked ? '$grey-500' : '$primary-500'} size={26} />
        ) : (
          <Circle size={24} borderWidth={2} borderColor="$grey-400" />
        )}
      </XStack>
    </Pressable>
  )
}

/**
 * The one screen where the user decides what goes into the wallet. The ZADA ID is what they
 * came for and is always included; every discovered legacy credential is listed individually and
 * can be left out — the platform's "user-initiated, per-credential, never silent bulk" rule.
 */
export function ReviewStep({
  state,
  discovering,
  discoveryNote,
  notifyStatus,
  busy,
  onToggle,
  onNotify,
  onAdd,
}: ReviewStepProps) {
  const { t } = useLingui()
  const selectedCount = state.credentials.filter((c) => !state.deselected.includes(c.id)).length
  // Legacy schemas without a display name only have a schema URL — useless to a holder, so list
  // the named ones (deduped) and fold the rest into a count.
  const blockedNames = [...new Set(state.blocked.map((b) => b.name).filter((n): n is string => !!n))]
  const unnamedBlocked = state.blocked.filter((b) => !b.name).length
  const total = selectedCount + 1

  return (
    <YStack gap="$5">
      <YStack gap="$2">
        <Heading heading="sub2" color="$grey-700">
          {t({ id: 'zadaId.review.yourId', message: 'Your ZADA ID' })}
        </Heading>
        <Row
          title={state.name ?? ''}
          subtitle={[state.phone ? formatE164(state.phone) : undefined, state.email].filter(Boolean).join(' · ')}
          selected
          locked
        />
      </YStack>

      <YStack gap="$2">
        <XStack ai="center" gap="$2">
          <Heading heading="sub2" color="$grey-700">
            {t({ id: 'zadaId.review.existing', message: 'Existing credentials' })}
          </Heading>
          {discovering ? <Spinner size="small" /> : null}
        </XStack>
        {state.credentials.length === 0 ? (
          <Paragraph variant="sub" color="$grey-600">
            {discovering
              ? t({ id: 'zadaId.review.searching', message: 'Looking for credentials issued to you before…' })
              : t({ id: 'zadaId.review.none', message: 'No earlier credentials were found for this phone or email.' })}
          </Paragraph>
        ) : (
          state.credentials.map((c: DiscoveredCredential) => (
            <Row
              key={c.id}
              title={c.display_name}
              subtitle={c.summary}
              selected={!state.deselected.includes(c.id)}
              onPress={() => onToggle(c.id)}
            />
          ))
        )}
        {discoveryNote ? (
          <Paragraph variant="sub" color="$warning-500">
            {discoveryNote}
          </Paragraph>
        ) : null}
      </YStack>

      {state.blocked.length > 0 ? (
        <YStack gap="$2" p="$3" br="$5" bg="$grey-100">
          <Paragraph fontWeight="$semiBold">
            <Trans id="zadaId.review.blockedTitle">{state.blocked.length} more can't be added yet</Trans>
          </Paragraph>
          {blockedNames.length > 0 ? (
            <Paragraph variant="sub" color="$grey-600">
              {blockedNames.join(', ')}
              {unnamedBlocked > 0 ? ` (+${unnamedBlocked})` : ''}
            </Paragraph>
          ) : null}
          <Paragraph variant="sub" color="$grey-600">
            {t({
              id: 'zadaId.review.blockedBody',
              message:
                'Their issuer has not finished setting up on the new network. We can tell you when they are ready.',
            })}
          </Paragraph>
          {notifyStatus === 'done' ? (
            <Paragraph variant="sub" color="$positive-500">
              {t({ id: 'zadaId.review.notifyDone', message: "We'll let you know." })}
            </Paragraph>
          ) : (
            <Button.Outline onPress={onNotify} disabled={notifyStatus === 'busy'}>
              {t({ id: 'zadaId.review.notifyMe', message: 'Notify me when ready' })}
            </Button.Outline>
          )}
        </YStack>
      ) : null}

      <Button.Solid onPress={onAdd} disabled={busy} opacity={busy ? 0.5 : 1}>
        {total === 1
          ? t({ id: 'zadaId.review.addOne', message: 'Add ZADA ID to wallet' })
          : t({ id: 'zadaId.review.addAll', message: 'Add to wallet' })}
      </Button.Solid>
    </YStack>
  )
}
