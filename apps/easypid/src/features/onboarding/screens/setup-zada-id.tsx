import { useLingui } from '@lingui/react/macro'
import { useImageScaler } from '@package/app/hooks'
import { commonMessages } from '@package/translations'
import { Button, HeroIcons, Paragraph, YStack } from '@package/ui'
import { mmkv } from '../../../storage/mmkv'
import { ZADA_ID_SETUP_PENDING_KEY } from '../../migration/useCredentialMigration'
import { BuildIdentity } from './assets/BuildIdentity'

interface OnboardingSetupZadaIdProps {
  goToNextStep: () => void
}

/**
 * Final onboarding step — set up the foundational ZADA ID. "Verify phone & email" finishes
 * onboarding and opens the native ZADA ID flow (`/zada-id`) on the dashboard: onboarding ends with
 * a route replace to `/`, so the step flags the intent and the dashboard opens the flow on mount.
 * For returning users the same flow also brings over their existing credentials. "Set up later"
 * skips straight to the wallet (the action stays available from the home screen and menu).
 */
export function OnboardingSetupZadaId({ goToNextStep }: OnboardingSetupZadaIdProps) {
  const { t } = useLingui()
  const { height, onLayout } = useImageScaler({ scaleFactor: 0.7 })

  const onVerify = () => {
    mmkv.set(ZADA_ID_SETUP_PENDING_KEY, true)
    goToNextStep()
  }

  const verifyLabel = t({
    id: 'onboardingSetupZadaId.verify',
    message: 'Verify phone & email',
    comment: 'Primary button to verify phone and email and set up the ZADA ID',
  })

  const microcopy = t({
    id: 'onboardingSetupZadaId.microcopyNative',
    message: 'Takes about a minute. You will need your phone and email to receive two short codes.',
    comment: 'Small text under the verify button explaining what the ZADA ID setup involves',
  })

  return (
    <YStack fg={1} jc="space-between" gap="$6">
      <YStack f={1} ai="center" onLayout={onLayout}>
        <YStack height={height} mt="$4">
          <BuildIdentity />
        </YStack>
      </YStack>
      <YStack gap="$3">
        <Button.Solid scaleOnPress alignSelf="stretch" onPress={onVerify}>
          {verifyLabel}
        </Button.Solid>
        <Paragraph variant="sub" ta="center" color="$grey-500" px="$4">
          {microcopy}
        </Paragraph>
        <Button.Text icon={HeroIcons.ArrowRight} scaleOnPress onPress={goToNextStep}>
          {t(commonMessages.setUpLater)}
        </Button.Text>
      </YStack>
    </YStack>
  )
}
