import { useLingui } from '@lingui/react/macro'
import { Blob, Button, FlexPage, Heading, Image, Paragraph, Stack, XStack, YStack } from '@package/ui'

export interface OnboardingWelcomeProps {
  goToNextStep: () => void
}

export default function OnboardingWelcome({ goToNextStep }: OnboardingWelcomeProps) {
  const { t } = useLingui()

  const introText = t({
    id: 'onboardingWelcome.description',
    message: 'This is your digital wallet. With it, you can store and share information about yourself.',
    comment: 'Intro paragraph on the welcome screen',
  })

  const getStartedLabel = t({
    id: 'onboardingWelcome.getStarted',
    message: 'Get Started',
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
          jc="center">
          <Image height={300} width={300} src={require('assets/welcome.png')}/>
        </YStack>
      </YStack>
      <FlexPage fg={1} jc="space-between" backgroundColor="$transparent">
        <Stack h="40%" />
        <YStack gap="$4" ai="center">
          <Heading fontSize={32}>ZADA Wallet</Heading>
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
