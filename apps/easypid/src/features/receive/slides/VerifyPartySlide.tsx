import { Trans, useLingui } from '@lingui/react/macro'
import type { DisplayImage, TrustedEntity, TrustMechanism } from '@package/agent'
import { DualResponseButtons, useWizard } from '@package/app'
import { commonMessages } from '@package/translations'
import { Circle, Heading, HeroIcons, Image, Paragraph, ScrollView, Stack, useMedia, XStack, YStack } from '@package/ui'
import { useState } from 'react'
import { NO_ENTITY_ID, PartyTrustSection } from '../components/PartyTrustSection'

interface VerifyPartySlideProps {
  type: 'offer' | 'request' | 'signing' | 'connect'
  host?: string
  name?: string
  entityId?: string
  logo?: DisplayImage
  backgroundColor?: string
  onContinue?: () => Promise<void>
  onDecline?: () => void
  trustedEntities?: Array<TrustedEntity>
  trustMechanism?: TrustMechanism
}

export const VerifyPartySlide = ({
  type,
  entityId = NO_ENTITY_ID,
  name,
  logo,
  backgroundColor,
  onContinue,
  onDecline,
  trustedEntities,
  trustMechanism = 'x509',
}: VerifyPartySlideProps) => {
  const media = useMedia()
  const { onNext, onCancel } = useWizard()
  const [isLoading, setIsLoading] = useState(false)
  const { t } = useLingui()
  const [isImageLoaded, setIsImageLoaded] = useState(false)

  const handleContinue = async () => {
    setIsLoading(true)
    if (onContinue) {
      await onContinue()
    }
    onNext()
    setIsLoading(false)
  }

  const handleDecline = async () => {
    onDecline?.()
    onCancel()
  }

  return (
    <YStack fg={1} jc="space-between">
      <ScrollView contentContainerStyle={{ gap: media.short ? '$4' : '$6' }}>
        <YStack gap="$4">
          <XStack ai="center" pt="$4" jc="center">
            <Circle size={88} bw="$0.5" borderColor="$grey-100" bg={backgroundColor ?? '$white'}>
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
                <HeroIcons.BuildingOffice color="$grey-800" size={36} />
              )}
            </Circle>
          </XStack>
          <Stack gap="$2">
            <Heading heading="h2" numberOfLines={2} center fontSize={24} lineHeight="$5">
              {name ? (
                <Trans id="verifyPartySlide.interactWithHeading">Do you trust {name}?</Trans>
              ) : (
                <Trans id="verifyPartySlide.organizationNotVerifiedHeading">Organization not verified</Trans>
              )}
            </Heading>
            {type === 'offer' ? (
              <Paragraph center px="$4">
                {name ? (
                  <Trans id="verifyPartySlide.offerCardSubtitle">{name} wants to offer you a Credential.</Trans>
                ) : (
                  <Trans id="verifyPartySlide.offerCardSubtitleUnknownOrganization">
                    An unknown organization wants to offer you a Credential.
                  </Trans>
                )}
              </Paragraph>
            ) : type === 'signing' ? (
              <Paragraph center px="$4">
                {name ? (
                  <Trans id="verifyPartySlide.signingSubtitle">
                    {name} wants to interact to create a digital signature for a document.
                  </Trans>
                ) : (
                  <Trans id="verifyPartySlide.signingSubtitleUnknownOrganization">
                    An unknown organization wants to interact to create a digital signature for a document.
                  </Trans>
                )}
              </Paragraph>
            ) : type === 'request' ? (
              <Paragraph center px="$4">
                {name ? (
                  <Trans id="verifyPartySlide.requestSubtitle">{name} wants to request information from you.</Trans>
                ) : (
                  <Trans id="verifyPartySlide.requestSubtitleUnknownOrganization">
                    An unknown organization wants to request information from you.
                  </Trans>
                )}
              </Paragraph>
            ) : type === 'connect' ? (
              <Paragraph center px="$4">
                {name ? (
                  <Trans id="verifyPartySlide.connectSubtitle">{name} wants to connect with you.</Trans>
                ) : (
                  <Trans id="verifyPartySlide.connectSubtitleUnknownOrganization">
                    An unknown organization wants to connect with you.
                  </Trans>
                )}
              </Paragraph>
            ) : null}
          </Stack>
        </YStack>

        <PartyTrustSection
          entityId={entityId}
          name={name}
          logo={logo}
          trustedEntities={trustedEntities}
          trustMechanism={trustMechanism}
        />
      </ScrollView>
      <Stack btw={1} borderColor="$grey-100" p="$4" mx="$-4">
        <DualResponseButtons
          align="horizontal"
          onAccept={handleContinue}
          onDecline={handleDecline}
          acceptText={t(commonMessages.confirmContinue)}
          declineText={t(commonMessages.stop)}
          isLoading={isLoading}
        />
      </Stack>
    </YStack>
  )
}
