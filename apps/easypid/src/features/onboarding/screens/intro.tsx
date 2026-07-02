import { useLingui } from '@lingui/react/macro'
import { useImageScaler } from '@package/app/hooks'
import { commonMessages } from '@package/translations'
import { AnimatedStack, Button, Heading, HeroIcons, Paragraph, useSpringify, XStack, YStack } from '@package/ui'
import { useRef, useState } from 'react'
import { Dimensions } from 'react-native'
import { LinearTransition } from 'react-native-reanimated'
import type { ICarouselInstance } from 'react-native-reanimated-carousel'
import Carousel from 'react-native-reanimated-carousel'
import { BuildIdentity } from './assets/BuildIdentity'
import { DigitalToPhysical } from './assets/DigitalToPhysical'
import { PrivacyControl } from './assets/PrivacyControl'
import { ScanCard } from './assets/ScanCard'

interface OnboardingIntroProps {
  onSkip: () => void
  goToNextStep: () => void
}

/**
 * Phase-1 education carousel shown right after the landing screen. Four swipeable slides that
 * explain what ZADA ID does before the user commits to setting up a PIN. Fully skippable — both
 * "Skip" and the final "Continue to setup" advance to the same next onboarding step (PIN).
 */
export function OnboardingIntro({ onSkip, goToNextStep }: OnboardingIntroProps) {
  const { t } = useLingui()
  const [currentSlide, setCurrentSlide] = useState(0)
  const { width } = Dimensions.get('window')
  const carouselRef = useRef<ICarouselInstance>(null)
  const { height, onLayout } = useImageScaler()

  const slides = [
    {
      image: <BuildIdentity />,
      title: t({
        id: 'onboardingIntro.slide1.title',
        message: 'Your official IDs, in your pocket',
        comment: 'Title for the identity slide of the intro carousel',
      }),
      subtitle: t({
        id: 'onboardingIntro.slide1.subtitle',
        message:
          'Set up your secure ZADA ID with your phone and email. Then scan your physical passport chip to instantly link your official, government-verified identity.',
        comment: 'Subtitle for the identity slide of the intro carousel',
      }),
    },
    {
      image: <ScanCard />,
      title: t({
        id: 'onboardingIntro.slide2.title',
        message: 'Scan to add',
        comment: 'Title for the scan slide of the intro carousel',
      }),
      subtitle: t({
        id: 'onboardingIntro.slide2.subtitle',
        message:
          'Use the built-in scanner to securely receive official digital documents — like degrees and certificates — directly from universities, employers, and organizations on the ZADA Network.',
        comment: 'Subtitle for the scan slide of the intro carousel',
      }),
    },
    {
      image: <PrivacyControl />,
      title: t({
        id: 'onboardingIntro.slide3.title',
        message: 'Share only what is needed',
        comment: 'Title for the privacy slide of the intro carousel',
      }),
      subtitle: t({
        id: 'onboardingIntro.slide3.subtitle',
        message:
          'When someone asks for your details, you are in charge. Prove you are over 18 without revealing your exact birthday, and keep your data stored securely on this device — not in the cloud.',
        comment: 'Subtitle for the privacy slide of the intro carousel',
      }),
    },
    {
      image: <DigitalToPhysical />,
      title: t({
        id: 'onboardingIntro.slide4.title',
        message: 'From digital to your wall',
        comment: 'Title for the digital-to-physical slide of the intro carousel',
      }),
      subtitle: t({
        id: 'onboardingIntro.slide4.subtitle',
        message:
          'Need a physical copy? Turn your digital certificates into beautifully designed, official PDFs that can be printed, framed, and verified anywhere — even offline.',
        comment: 'Subtitle for the digital-to-physical slide of the intro carousel',
      }),
    },
  ]

  const continueToSetupLabel = t({
    id: 'onboardingIntro.continueToSetup',
    message: 'Continue to setup',
    comment: 'Button label on the last intro slide to start wallet setup',
  })

  const skipLabel = t({
    id: 'onboardingIntro.skip',
    message: 'Skip',
    comment: 'Button label to skip the intro carousel',
  })

  const continueLabel = t(commonMessages.continue)

  const handleNext = () => {
    if (currentSlide === slides.length - 1) {
      goToNextStep()
    } else {
      carouselRef.current?.next()
    }
  }

  return (
    <YStack fg={1} gap="$6" jc="space-between">
      <YStack fg={1} mt="$-5">
        <Carousel
          ref={carouselRef}
          loop={false}
          width={width}
          data={slides}
          pagingEnabled={true}
          snapEnabled={true}
          containerStyle={{ width: '100%', flex: 1 }}
          onProgressChange={(_, absoluteProgress) => {
            const nextIndex = Math.round(absoluteProgress)
            if (nextIndex !== currentSlide) {
              setCurrentSlide(nextIndex)
            }
          }}
          renderItem={({ item }) => (
            <AnimatedStack flexDirection="column" flex={1} gap="$3" pr={36}>
              <Heading heading="h1">{item.title}</Heading>
              <Paragraph>{item.subtitle}</Paragraph>
              <YStack ai="center" f={1} onLayout={onLayout} pos="relative">
                <YStack height={height} mt="$4">
                  {item.image}
                </YStack>
              </YStack>
            </AnimatedStack>
          )}
        />
      </YStack>

      <AnimatedStack flexDirection="column" gap="$6" layout={useSpringify(LinearTransition)}>
        {/* Slide indicators */}
        <XStack jc="center" gap="$2">
          {slides.map((_, index) => (
            <AnimatedStack
              key={`indicator-${index}-${currentSlide === index}`}
              h="$0.75"
              layout={useSpringify(LinearTransition)}
              w={currentSlide === index ? 32 : 16}
              br="$12"
              bg={currentSlide === index ? '$primary-500' : '$grey-100'}
            />
          ))}
        </XStack>
        <YStack gap="$4">
          <Button.Solid onPress={handleNext}>
            {currentSlide === slides.length - 1 ? continueToSetupLabel : continueLabel}
          </Button.Solid>
          {currentSlide !== slides.length - 1 && (
            <Button.Text onPress={onSkip}>
              <HeroIcons.ArrowRight color="$primary-500" size={20} /> {skipLabel}
            </Button.Text>
          )}
        </YStack>
      </AnimatedStack>
    </YStack>
  )
}
