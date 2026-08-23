import { useLingui } from '@lingui/react/macro'
import { useImageScaler } from '@package/app/hooks'
import {
  canUseBiometryBackedWalletKeyQueryKey,
  useCanUseBiometryBackedWalletKey,
} from '@package/secure-store/secureUnlock'
import { commonMessages } from '@package/translations'
import { Button, HeroIcons, Paragraph, Spinner, YStack } from '@package/ui'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { AppState } from 'react-native'
import { SetUpBiometrics } from './assets/SetUpBiometrics'

interface OnboardingBiometricsProps {
  goToNextStep: (enableBiometrics: boolean) => Promise<void>
  actionText: string
  skipText?: string
  /**
   * Only the 'biometrics' step offers to enable biometrics. The 'biometrics-disabled' step reuses
   * this screen to send the user to the system settings, where the support check says nothing
   * useful (biometrics is unavailable there by definition — that is why we're on that screen).
   */
  checkBiometricsSupport?: boolean
}

export function OnboardingBiometrics({
  goToNextStep,
  actionText,
  skipText,
  checkBiometricsSupport = false,
}: OnboardingBiometricsProps) {
  const { t } = useLingui()
  const [isLoading, setIsLoading] = useState(false)
  const { height, onLayout } = useImageScaler({ scaleFactor: 0.6 })

  /**
   * `undefined` while the check is still running. Offering "Activate Biometrics" on a device that
   * cannot store a biometry-backed wallet key used to throw the user back to the PIN step with a
   * generic error, so we don't offer it at all when we already know it will fail.
   */
  const canUseBiometrics = useCanUseBiometryBackedWalletKey()
  const isCheckingBiometrics = checkBiometricsSupport && canUseBiometrics === undefined
  const biometricsUnavailable = checkBiometricsSupport && canUseBiometrics === false

  /**
   * The answer changes outside the app: the user can leave for the system settings, enrol a
   * fingerprint, and come back. Nothing else re-runs the check (react-query's focus manager isn't
   * wired to AppState here), so a cached "no" would otherwise stick for the rest of onboarding.
   */
  const queryClient = useQueryClient()
  useEffect(() => {
    if (!checkBiometricsSupport) return

    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void queryClient.invalidateQueries({ queryKey: canUseBiometryBackedWalletKeyQueryKey })
      }
    })
    return () => subscription.remove()
  }, [checkBiometricsSupport, queryClient])

  const runStep = (enableBiometrics: boolean) => {
    if (isLoading) return

    setIsLoading(true)
    goToNextStep(enableBiometrics)
      // It's ok to not handle this
      .catch(() => {})
      .finally(() => setIsLoading(false))
  }

  return (
    <YStack fg={1} jc="space-between" gap="$6">
      <YStack f={1} ai="center" onLayout={onLayout}>
        <YStack height={height} mt="$4">
          <SetUpBiometrics />
        </YStack>
      </YStack>
      <YStack>
        {biometricsUnavailable ? (
          <>
            <Paragraph ta="center" color="$grey-700" mb="$4">
              {t({
                id: 'biometrics.notAvailableOnThisDevice',
                message: 'This device cannot protect your wallet with biometrics. You will unlock with your PIN.',
                comment: 'Shown when the device does not support biometry-backed key storage',
              })}
            </Paragraph>
            <Button.Solid fg={1} scaleOnPress disabled={isLoading} alignSelf="stretch" onPress={() => runStep(false)}>
              {isLoading ? <Spinner variant="dark" /> : t(commonMessages.continue)}
            </Button.Solid>
          </>
        ) : (
          <>
            <Button.Solid
              fg={1}
              scaleOnPress
              disabled={isLoading || isCheckingBiometrics}
              alignSelf="stretch"
              onPress={() => runStep(true)}
            >
              {isLoading || isCheckingBiometrics ? <Spinner variant="dark" /> : actionText}
            </Button.Solid>

            {skipText && (
              <Button.Text icon={HeroIcons.ArrowRight} scaleOnPress onPress={() => runStep(false)}>
                {skipText}
              </Button.Text>
            )}
          </>
        )}
      </YStack>
    </YStack>
  )
}
