import { type AppAgent, initializeAppAgent, useSecureUnlock } from '@easypid/agent'
import { setWalletServiceProviderPin } from '@easypid/crypto/WalletServiceProviderClient'
import { isParadymWallet } from '@easypid/hooks/useFeatureFlag'
import { resetWallet } from '@easypid/utils/resetWallet'
import type { OnboardingPage, OnboardingStep } from '@easypid/utils/sharedPidSetup'
import { useLingui } from '@lingui/react/macro'
import {
  BiometricAuthenticationCancelledError,
  BiometricAuthenticationNotEnabledError,
  migrateLegacyParadymWallet,
} from '@package/agent'
import { useHaptics } from '@package/app'
import { getLegacySecureWalletKey, removeLegacySecureWalletKey } from '@package/secure-store/legacyUnlock'
import { secureWalletKey, setIsBiometricsEnabled } from '@package/secure-store/secureUnlock'
import { commonMessages } from '@package/translations'
import { useToastController } from '@package/ui'
import { sleep } from '@package/utils'
import { useRouter } from 'expo-router'
import type React from 'react'
import { createContext, type PropsWithChildren, useCallback, useContext, useEffect, useState } from 'react'
import { Linking } from 'react-native'
import { useHasFinishedOnboarding } from './hasFinishedOnboarding'
import { clearLastOnboardingError, type OnboardingErrorStep, recordOnboardingError } from './onboardingError'
import { onboardingSteps } from './steps'

export type OnboardingContext = {
  currentStep: OnboardingStep['step']
  progress: number
  page: OnboardingPage
  screen: React.JSX.Element
  reset: () => void
}

export const OnboardingContext = createContext<OnboardingContext>({} as OnboardingContext)

export function OnboardingContextProvider({
  initialStep,
  children,
}: PropsWithChildren<{
  initialStep?: OnboardingStep['step']
}>) {
  const { successHaptic, lightHaptic } = useHaptics()
  const toast = useToastController()
  const secureUnlock = useSecureUnlock()
  const [currentStepName, setCurrentStepName] = useState<OnboardingStep['step']>(initialStep ?? 'welcome')
  const router = useRouter()
  const [, setHasFinishedOnboarding] = useHasFinishedOnboarding()
  const { t } = useLingui()

  const currentStep = onboardingSteps.find((step) => step.step === currentStepName)
  if (!currentStep) throw new Error(`Invalid step ${currentStepName}`)

  const [walletPin, setWalletPin] = useState<string>()
  const [agent, setAgent] = useState<AppAgent>()
  const [progressBar, setProgressBar] = useState<typeof currentStep.progress | 100>(currentStep.progress)

  useEffect(() => {
    if (currentStepName && currentStepName !== 'welcome' && currentStepName !== 'pin-reenter') {
      lightHaptic()
    }
  }, [lightHaptic, currentStepName])

  const goToNextStep = useCallback(async () => {
    const currentStepIndex = onboardingSteps.findIndex((step) => step.step === currentStepName)
    // goToNextStep excludes alternative flows
    const nextStep = onboardingSteps.slice(currentStepIndex + 1).find((step) => !step.alternativeFlow)

    if (nextStep) {
      setCurrentStepName(nextStep.step)
    } else {
      // Animate the progress bar to 100% to gracefully finish onboarding and enter home screen
      if (progressBar !== 100) {
        setProgressBar(100)
        await sleep(600)
      }
      finishOnboarding()
    }
  }, [currentStepName, progressBar])

  const goToPreviousStep = useCallback(() => {
    const currentStepIndex = onboardingSteps.findIndex((step) => step.step === currentStepName)
    const previousStep = [...onboardingSteps.slice(0, currentStepIndex)].reverse().find((step) => !step.alternativeFlow)

    if (previousStep) {
      setCurrentStepName(previousStep.step)
    }
  }, [currentStepName])

  const finishOnboarding = useCallback(() => {
    clearLastOnboardingError()
    setHasFinishedOnboarding(true)
    // The Onboarding fades out based on the mmkv value
    // Wait 500ms before navigating to home
    setTimeout(() => {
      router.replace('/')
      successHaptic()
    }, 500)
  }, [router, setHasFinishedOnboarding, successHaptic])

  const onPinEnter = async (pin: string) => {
    setWalletPin(pin)
    goToNextStep()
  }

  // Bit sad but if we try to call this in the initializeAgent callback sometimes the state hasn't updated
  // in the secure unlock yet, which means that it will throw an error, so we use an effect. Probably need
  // to do a refactor on this and move more logic outside of the react world, as it's a bit weird with state
  useEffect(() => {
    if (secureUnlock.state !== 'acquired-wallet-key' || !agent) return
  }, [secureUnlock, agent])

  const initializeAgent = useCallback(async (walletKey: string) => {
    const agent = await initializeAppAgent({
      walletKey,
      walletKeyVersion: secureWalletKey.getWalletKeyVersion(),
      registerWallet: true,
    })
    setAgent(agent)
  }, [])

  const onPinReEnter = async (pin: string) => {
    if (!walletPin || walletPin !== pin) {
      toast.show(
        t({
          id: 'onboarding.pinEntriesDoNotMatch',
          message: 'Pin entries do not match',
        }),
        {
          customData: { preset: 'danger' },
        }
      )
      setWalletPin(undefined)
      goToPreviousStep()
      throw new Error('Pin entries do not match')
    }

    if (secureUnlock.state !== 'not-configured') {
      router.replace('/')
      return
    }

    return secureUnlock
      .setup(walletPin as string)
      .then(async ({ walletKey }) => {
        await setWalletServiceProviderPin((walletPin as string).split('').map(Number), false)

        if (isParadymWallet()) {
          const legacyWalletKey = await getLegacySecureWalletKey().catch(() => null)

          if (legacyWalletKey) {
            await migrateLegacyParadymWallet({
              legacyWalletKey,
              newWalletKey: walletKey,
              walletKeyVersion: secureWalletKey.getWalletKeyVersion(),
            })
              .catch((e) => {
                // We ignore this, it's unfortunate but the wallet migration failed
                console.error('error migrating wallet', e)
              })
              .finally(async () => {
                await removeLegacySecureWalletKey()
              })
          }
        }

        await initializeAgent(walletKey)
      })
      .then(goToNextStep)
      .catch((e) => {
        reset({ error: e, errorStep: 'pin', resetToStep: 'welcome' })
        throw e
      })
  }

  const onEnableBiometricsDisabled = async () => {
    return Linking.openSettings().then(() => setCurrentStepName('biometrics'))
  }

  const onEnableBiometrics = async (enableBiometrics: boolean) => {
    if (!agent || (secureUnlock.state !== 'acquired-wallet-key' && secureUnlock.state !== 'unlocked')) {
      await reset({
        resetToStep: 'pin',
        error: new Error('Missing agent or unlocked wallet key when enabling biometrics'),
        errorStep: 'biometrics',
        // Internal state bug, not something to put in front of the user
        toastMessage: t(commonMessages.pleaseTryAgain),
      })
      return
    }

    try {
      if (secureUnlock.state === 'acquired-wallet-key') {
        await secureUnlock.setWalletKeyValid({ agent }, { enableBiometrics })
      }

      // Directly try getting the wallet key so the user can enable biometrics
      // and we can check if biometrics works
      const walletKey = enableBiometrics
        ? await secureWalletKey.getWalletKeyUsingBiometrics(secureWalletKey.getWalletKeyVersion())
        : undefined

      if (!walletKey) {
        const walletKey =
          secureUnlock.state === 'acquired-wallet-key'
            ? secureUnlock.walletKey
            : secureUnlock.context.agent.modules.askar.config.store.key
        if (!walletKey) {
          await reset({
            resetToStep: 'pin',
            error: new Error('No wallet key available when enabling biometrics'),
            errorStep: 'biometrics',
            toastMessage: t(commonMessages.pleaseTryAgain),
          })
          return
        }

        if (enableBiometrics) {
          await secureWalletKey.storeWalletKey(walletKey, secureWalletKey.getWalletKeyVersion())
          await secureWalletKey.getWalletKeyUsingBiometrics(secureWalletKey.getWalletKeyVersion())
        }
      }

      goToNextStep()
    } catch (error) {
      // We can recover from this, and will show an error on the screen
      if (error instanceof BiometricAuthenticationCancelledError) {
        toast.show(t(commonMessages.biometricAuthenticationCancelled), {
          customData: { preset: 'danger' },
        })
        throw error
      }

      if (error instanceof BiometricAuthenticationNotEnabledError) {
        setCurrentStepName('biometrics-disabled')
        throw error
      }

      /**
       * Anything else means this device won't give us biometry-backed key storage — OEM keystore
       * quirks are common and we can't enumerate them. That is not a reason to throw away a wallet
       * the user just created: we used to `reset()` here, which wiped the wallet and dropped the
       * user back on the PIN screen, so a device that can never store the key looped forever.
       *
       * Continue with PIN-only unlock instead; biometrics stays available in Settings.
       */
      recordOnboardingError('biometrics', error)
      console.error('error enabling biometrics', error)

      setIsBiometricsEnabled(false)
      // Best effort: drop a key that may have been stored before the failure
      await secureWalletKey.removeWalletKey(secureWalletKey.getWalletKeyVersion()).catch(() => {})

      toast.show(
        t({
          id: 'onboarding.biometricsNotEnabled',
          message: 'Could not enable biometrics',
        }),
        {
          // Plain language only. The full technical reason is recorded above and travels with
          // the support chat — it does not belong in front of the user.
          message: t({
            id: 'onboarding.biometricsNotEnabledDescription',
            message: 'Your wallet is still protected by your PIN. You can try again in Settings.',
          }),
          customData: { preset: 'danger' },
        }
      )

      goToNextStep()
    }
  }

  const reset = async ({
    resetToStep = 'welcome',
    error,
    errorStep,
    showToast = true,
    toastMessage,
  }: {
    error?: unknown
    /** Which part of onboarding failed, for the support diagnostics. */
    errorStep?: OnboardingErrorStep
    resetToStep: OnboardingStep['step']
    showToast?: boolean
    toastMessage?: string
  }) => {
    if (error) {
      console.error(error)
      if (errorStep) recordOnboardingError(errorStep, error)
    }

    const stepsToCompleteAfterReset = onboardingSteps
      .slice(onboardingSteps.findIndex((step) => step.step === resetToStep))
      .map((step) => step.step)

    if (stepsToCompleteAfterReset.includes('pin')) {
      // Reset PIN state
      setWalletPin(undefined)
      setAgent(undefined)
    }

    if (stepsToCompleteAfterReset.includes('pin')) {
      await resetWallet(secureUnlock)
    }

    // TODO: if we already have the agent, we should either remove the wallet and start again,
    // or we need to start from the id card flow
    setCurrentStepName(resetToStep)

    if (showToast) {
      toast.show(
        t({
          id: 'onboarding.errorOccurred',
          message: 'Error occurred during onboarding',
        }),
        {
          // The reason goes to `recordOnboardingError`, not to the user. Raw exception text in a
          // digital identity app reads as broken, and every Android user hits this today.
          message: toastMessage ?? t(commonMessages.pleaseTryAgain),
          customData: {
            preset: 'danger',
          },
        }
      )
    }
  }

  let screen: React.JSX.Element
  if (currentStep.step === 'welcome') {
    screen = <currentStep.Screen goToNextStep={goToNextStep} />
  } else if (currentStep.step === 'intro') {
    // Both "Skip" and finishing the last slide advance to the next step (PIN).
    screen = <currentStep.Screen onSkip={goToNextStep} goToNextStep={goToNextStep} />
  } else if (currentStep.step === 'pin' || currentStep.step === 'pin-reenter') {
    screen = (
      <currentStep.Screen
        key={currentStep.page.animationKey}
        goToNextStep={currentStep.step === 'pin' ? onPinEnter : onPinReEnter}
      />
    )
  } else if (currentStep.step === 'biometrics') {
    screen = (
      <currentStep.Screen
        goToNextStep={onEnableBiometrics}
        checkBiometricsSupport
        actionText={t({
          id: 'biometrics.activateBiometricsButton',
          message: 'Activate Biometrics',
        })}
        skipText={t(commonMessages.setUpLater)}
      />
    )
  } else if (currentStep.step === 'biometrics-disabled') {
    screen = (
      <currentStep.Screen goToNextStep={onEnableBiometricsDisabled} actionText={t(commonMessages.openSettingsButton)} />
    )
  } else {
    screen = <currentStep.Screen goToNextStep={goToNextStep} />
  }

  const onUserReset = () =>
    reset({
      resetToStep: 'welcome',
      showToast: false,
    })

  return (
    <OnboardingContext.Provider
      value={{
        currentStep: currentStep.step,
        progress: Math.max(currentStep.progress, progressBar),
        page: currentStep.page,
        reset: onUserReset,
        screen,
      }}
    >
      {children}
    </OnboardingContext.Provider>
  )
}

export function useOnboardingContext() {
  const value = useContext(OnboardingContext)
  if (!value) {
    throw new Error('useOnboardingContext must be wrapped in a <OnboardingContext.Provider />')
  }

  return value
}
