import { useLingui } from '@lingui/react/macro'
import { useImageScaler } from '@package/app/hooks'
import { commonMessages } from '@package/translations'
import { Button, HeroIcons, Paragraph, Spinner, YStack } from '@package/ui'
import { useState } from 'react'
import { useCredentialMigration } from '../../migration/useCredentialMigration'
import { BuildIdentity } from './assets/BuildIdentity'

interface OnboardingSetupZadaIdProps {
  goToNextStep: () => void
}

/**
 * Final onboarding step — set up the foundational ZADA ID. "Verify phone & email" hands off to the
 * credential-key-usher web flow (via {@link useCredentialMigration}); for returning users this also
 * brings over their existing credentials as `openid-credential-offer://` deep links. The browser
 * round-trip is fire-and-continue: we don't block finishing onboarding on it, and "Set up later"
 * skips straight to the wallet (the action stays available from the home screen).
 */
export function OnboardingSetupZadaId({ goToNextStep }: OnboardingSetupZadaIdProps) {
  const { t } = useLingui()
  const { startMigration } = useCredentialMigration()
  const { height, onLayout } = useImageScaler({ scaleFactor: 0.7 })
  const [isLoading, setIsLoading] = useState(false)

  const onVerify = async () => {
    if (isLoading) return
    setIsLoading(true)
    try {
      await startMigration()
    } finally {
      setIsLoading(false)
      goToNextStep()
    }
  }

  const verifyLabel = t({
    id: 'onboardingSetupZadaId.verify',
    message: 'Verify phone & email',
    comment: 'Primary button to verify phone and email and set up the ZADA ID',
  })

  const microcopy = t({
    id: 'onboardingSetupZadaId.microcopy',
    message: 'You will be securely redirected to your browser to complete verification.',
    comment: 'Small text explaining the browser redirect for verification',
  })

  return (
    <YStack fg={1} jc="space-between" gap="$6">
      <YStack f={1} ai="center" onLayout={onLayout}>
        <YStack height={height} mt="$4">
          <BuildIdentity />
        </YStack>
      </YStack>
      <YStack gap="$3">
        <Button.Solid scaleOnPress disabled={isLoading} alignSelf="stretch" onPress={onVerify}>
          {isLoading ? <Spinner variant="dark" /> : verifyLabel}
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
