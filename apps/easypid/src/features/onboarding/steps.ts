import { type OnboardingStep, pidSetupMessages } from '@easypid/utils/sharedPidSetup'
import { defineMessage } from '@lingui/core/macro'
import { OnboardingBiometrics } from './screens/biometrics'
import { OnboardingDataProtection } from './screens/data-protection'
import { OnboardingIntro } from './screens/intro'
import OnboardingPinEnter from './screens/pin'
import { OnboardingSetupZadaId } from './screens/setup-zada-id'
import OnboardingWelcome from './screens/welcome'

// Shared messages
const pinTitle = defineMessage({
  id: 'onboarding.pin.title',
  message: 'Choose a 6-digit PIN',
  comment: 'Heading when user chooses a PIN',
})

const pinSubtitle = defineMessage({
  id: 'onboarding.pin.subtitle',
  message: 'This PIN secures your wallet. You enter it every time you open the app or share data.',
  comment: 'Explanation of the PIN purpose in onboarding',
})

const pinReenterTitle = defineMessage({
  id: 'onboarding.pinReenter.title',
  message: 'Repeat your PIN',
  comment: 'Heading when user repeats their PIN',
})

const biometricsTitle = defineMessage({
  id: 'onboarding.biometrics.title',
  message: 'Set up biometrics',
  comment: 'Heading when user sets up biometrics',
})

const biometricsSubtitle = defineMessage({
  id: 'onboarding.biometrics.subtitle',
  message:
    'Activate the biometrics functionality of your phone to make sure only you can enter your wallet and share data.',
  comment: 'Subtitle explaining purpose of biometrics',
})

const setupZadaIdTitle = defineMessage({
  id: 'onboarding.setupZadaId.title',
  message: 'Set up your ZADA ID',
  comment: 'Heading for the ZADA ID setup step',
})

const setupZadaIdSubtitle = defineMessage({
  id: 'onboarding.setupZadaId.subtitle',
  message:
    'Verify your phone number and email to unlock your foundational digital identity. If you have used ZADA before, this will also safely transfer your existing credentials to your new wallet.',
  comment: 'Subtitle explaining what setting up the ZADA ID does',
})

export const onboardingSteps = [
  {
    step: 'welcome',
    alternativeFlow: false,
    progress: 0,
    page: {
      type: 'fullscreen',
    },
    Screen: OnboardingWelcome,
  },
  {
    step: 'intro',
    alternativeFlow: false,
    progress: 10,
    page: {
      type: 'content',
    },
    Screen: OnboardingIntro,
  },
  {
    step: 'pin',
    alternativeFlow: false,
    progress: 25,
    page: {
      type: 'content',
      title: pinTitle,
      subtitle: pinSubtitle,
      animationKey: 'pin',
      animation: 'delayed',
    },
    Screen: OnboardingPinEnter,
  },
  {
    step: 'pin-reenter',
    alternativeFlow: false,
    progress: 25,
    page: {
      type: 'content',
      title: pinReenterTitle,
      subtitle: pinSubtitle,
      animationKey: 'pin',
    },
    Screen: OnboardingPinEnter,
  },
  {
    step: 'biometrics',
    alternativeFlow: false,
    progress: 45,
    page: {
      type: 'content',
      title: biometricsTitle,
      subtitle: biometricsSubtitle,
    },
    Screen: OnboardingBiometrics,
  },
  {
    step: 'biometrics-disabled',
    progress: 45,
    alternativeFlow: true,
    page: {
      type: 'content',
      ...pidSetupMessages.idCardBiometricsDisabled,
      animation: 'delayed',
    },
    Screen: OnboardingBiometrics,
  },
  {
    step: 'data-protection',
    alternativeFlow: false,
    progress: 65,
    page: {
      type: 'content',
      ...pidSetupMessages.dataProtection,
    },
    Screen: OnboardingDataProtection,
  },
  {
    step: 'setup-zada-id',
    alternativeFlow: false,
    progress: 85,
    page: {
      type: 'content',
      title: setupZadaIdTitle,
      subtitle: setupZadaIdSubtitle,
    },
    Screen: OnboardingSetupZadaId,
  },
] as const satisfies Array<OnboardingStep>
