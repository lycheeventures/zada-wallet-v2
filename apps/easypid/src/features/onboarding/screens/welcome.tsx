import { useLingui } from '@lingui/react/macro'
import { Blob, Button, FlexPage, Heading, Image, Paragraph, Stack, XStack, YStack } from '@package/ui'

export interface OnboardingWelcomeProps {
  goToNextStep: () => void
}

export default function OnboardingWelcome({ goToNextStep }: OnboardingWelcomeProps) {
  const { t } = useLingui()

  const introText = t({
    id: 'onboardingWelcome.description',
    message: 'Your identity, safely in your pocket. The secure way to hold and share your verified documents.',
    comment: 'Intro paragraph on the welcome screen',
  })

  const getStartedLabel = t({
    id: 'onboardingWelcome.getStarted',
    message: 'Start',
    comment: 'Button label to begin onboarding from the welcome screen',
  })

  return (
    <YStack fg={1} pos="relative">
      <YStack pos="absolute" h="50%" w="100%">
        <Blob />
        <YStack
          transform={[{ translateX: -150 }]} // Half of the image width (96/2)
          pos="absolute"
          top="20%"
          left="50%"
          ai="center"
          jc="center"
        >
          <Image height={300} width={300} src={require('assets/welcome.png')} />
        </YStack>
      </YStack>
      <FlexPage fg={1} jc="space-between" backgroundColor="$transparent">
        <Stack h="40%" />
        <YStack gap="$4" ai="center">
          <Heading fontSize={32} ta="center">
            Welcome to ZADA ID Wallet
          </Heading>
          <Paragraph px="$2" ta="center">
            {introText}
          </Paragraph>
        </YStack>
        <XStack gap="$2">
          <Button.Solid flexGrow={1} onPress={goToNextStep}>
            {getStartedLabel}
          </Button.Solid>
        </XStack>
      </FlexPage>
    </YStack>
  )
}
