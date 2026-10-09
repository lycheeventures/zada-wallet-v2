import type { OverAskingResponse } from '@easypid/use-cases/OverAskingApi'
import { Trans, useLingui } from '@lingui/react/macro'
import type { DisplayImage, FormattedSubmission, TrustedEntity, TrustMechanism } from '@package/agent'
import { DualResponseButtons, useScrollViewPosition, useWizard } from '@package/app'
import { commonMessages } from '@package/translations'
import { Button, Circle, Heading, HeroIcons, Image, Paragraph, ScrollView, Stack, XStack, YStack } from '@package/ui'
import { useState } from 'react'
import { Spacer } from 'tamagui'
import { PartyTrustSection } from '../../receive/components/PartyTrustSection'
import { RequestedAttributesSection } from '../components/RequestedAttributesSection'
import { RequestPurposeSection } from '../components/RequestPurposeSection'

interface ReviewAndShareSlideProps {
  entityId?: string
  verifierName?: string
  logo?: DisplayImage
  trustedEntities?: Array<TrustedEntity>
  trustMechanism?: TrustMechanism
  submission: FormattedSubmission
  overAskingResponse?: OverAskingResponse
  isAccepting: boolean
  /**
   * When set, sharing happens from this slide. When undefined (a PIN is required and biometrics
   * cannot stand in for it), pressing Share advances to the PIN slide, which performs the share.
   * Resolving `'pin-required'` means biometrics did not go through: advance to the PIN slide.
   */
  onAccept?: () => Promise<undefined | 'pin-required'>
  onDecline: () => void
}

/**
 * The whole decision on one screen: who is asking (and whether ZADA verified them), why, and
 * which cards go out — then Share. Replaces the two-step "Do you trust X?" → "Review the
 * request" part of the sharing wizard. Every fact stays tappable (trust detail, previous
 * interactions, card detail), but the user no longer clicks through a screen per fact.
 */
export const ReviewAndShareSlide = ({
  entityId,
  verifierName,
  logo,
  trustedEntities,
  trustMechanism,
  submission,
  overAskingResponse,
  isAccepting,
  onAccept,
  onDecline,
}: ReviewAndShareSlideProps) => {
  const { onNext, onCancel } = useWizard()
  const [scrollViewHeight, setScrollViewHeight] = useState(0)
  const { isScrolledByOffset, handleScroll, scrollEventThrottle } = useScrollViewPosition()
  const [isProcessing, setIsProcessing] = useState(isAccepting)
  const [isImageLoaded, setIsImageLoaded] = useState(false)
  const { t } = useLingui()

  const handleAccept = async () => {
    // Manually set to instantly show the loading state
    setIsProcessing(true)

    const result = await onAccept?.()
    if (result === 'pin-required') {
      setIsProcessing(false)
      onNext('pin-enter')
      return
    }
    onNext(onAccept ? 'success' : undefined)
  }

  const fallbackPurpose = t({
    id: 'submission.fallbackPurpose',
    message: 'No information was provided on the purpose of the data request. Be cautious',
    comment: 'Shown when a submission has no stated purpose',
  })

  const shareLabel = t({
    id: 'submission.share',
    message: 'Share',
    comment: 'Button label to accept and share credentials',
  })

  return (
    <YStack fg={1} jc="space-between">
      <YStack gap="$4" fg={1}>
        <XStack gap="$3" ai="center">
          <Circle size={56} bw="$0.5" borderColor="$grey-100" bg="$white" overflow="hidden">
            {logo?.url ? (
              <Image
                circle
                src={logo.url}
                alt={logo.altText}
                testID={isImageLoaded ? 'entity-image-loaded' : 'entity-image'}
                onLoad={() => setIsImageLoaded(true)}
                width="100%"
                height="100%"
                contentFit="contain"
              />
            ) : (
              <HeroIcons.BuildingOffice color="$grey-800" size={28} />
            )}
          </Circle>
          <YStack f={1} gap="$1">
            <Heading heading="h2" numberOfLines={2} fontSize={22} lineHeight="$5">
              {verifierName ? (
                <Trans id="reviewAndShare.heading" comment="Heading of the single-screen share flow">
                  Share with {verifierName}?
                </Trans>
              ) : (
                <Trans id="reviewAndShare.headingUnknownOrganization">Share with an unknown organization?</Trans>
              )}
            </Heading>
            <Paragraph variant="sub">
              <Trans id="reviewAndShare.subtitle" comment="Subtitle under the heading of the single-screen share flow">
                Check who is asking, why, and what will be shared.
              </Trans>
            </Paragraph>
          </YStack>
        </XStack>

        <YStack
          fg={1}
          px="$4"
          mx="$-4"
          onLayout={(event) => {
            if (!scrollViewHeight) setScrollViewHeight(event.nativeEvent.layout.height)
          }}
          btw="$0.5"
          borderColor={isScrolledByOffset ? '$grey-200' : '$background'}
        >
          <ScrollView
            onScroll={handleScroll}
            scrollEventThrottle={scrollEventThrottle}
            contentContainerStyle={{ gap: '$6' }}
            px="$4"
            mx="$-4"
            pt="$4"
            maxHeight={scrollViewHeight}
            bg="$white"
          >
            <PartyTrustSection
              entityId={entityId}
              name={verifierName}
              logo={logo}
              trustedEntities={trustedEntities}
              trustMechanism={trustMechanism}
            />
            <RequestPurposeSection
              purpose={submission.purpose ?? fallbackPurpose}
              overAskingResponse={
                submission.areAllSatisfied ? overAskingResponse : { validRequest: 'could_not_determine', reason: '' }
              }
              logo={logo}
            />
            <RequestedAttributesSection submission={submission} />
            <Spacer />
          </ScrollView>
        </YStack>
      </YStack>

      <YStack btw="$0.5" borderColor="$grey-200" py="$4" mx="$-4" px="$4" bg="$background">
        {submission.areAllSatisfied ? (
          <DualResponseButtons
            align="horizontal"
            acceptText={shareLabel}
            declineText={t(commonMessages.stop)}
            onAccept={handleAccept}
            onDecline={onCancel}
            isLoading={isProcessing}
          />
        ) : (
          <Stack gap="$3">
            <Paragraph variant="sub" fontWeight="$medium" ta="center" color="$danger-500">
              <Trans id="submission.missingCardsWarning" comment="Shown when user lacks required credentials">
                You don't have the required cards
              </Trans>
            </Paragraph>
            <Button.Solid onPress={onDecline}>{t(commonMessages.close)}</Button.Solid>
          </Stack>
        )}
      </YStack>
    </YStack>
  )
}
