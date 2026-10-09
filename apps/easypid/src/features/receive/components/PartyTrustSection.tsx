import { useLingui } from '@lingui/react/macro'
import { type DisplayImage, type TrustedEntity, type TrustMechanism, useActivities } from '@package/agent'
import { useHaptics } from '@package/app'
import { commonMessages } from '@package/translations'
import { InfoButton, YStack } from '@package/ui'
import { formatRelativeDate } from '@package/utils'
import { useRouter } from 'expo-router'

export const NO_ENTITY_ID = 'NO_ENTITY_ID'

export interface PartyTrustSectionProps {
  entityId?: string
  name?: string
  logo?: DisplayImage
  trustedEntities?: Array<TrustedEntity>
  trustMechanism?: TrustMechanism
}

/**
 * The tappable trust facts about the other party: how (and whether) ZADA verified it, the demo
 * warning, and the previous-interaction history. Shared by the standalone "Do you trust X?"
 * slide (issuance) and the single-screen presentation review (sharing), so the two flows can
 * never drift in what they claim about an organisation.
 */
export function PartyTrustSection({
  entityId = NO_ENTITY_ID,
  name,
  logo,
  trustedEntities,
  trustMechanism = 'x509',
}: PartyTrustSectionProps) {
  const router = useRouter()
  const { withHaptics } = useHaptics()
  const { activities } = useActivities({ filters: { entityId } })
  const lastInteractionDate = activities[0]?.date
  const { t } = useLingui()

  const entityIsTrustAnchor = trustedEntities?.some((entity) => entity.entityId === entityId)
  const isDemoTrustedEntity = trustedEntities?.some((entity) => entity.demo) ?? false
  const trustedEntitiesWithoutSelf = trustedEntities
    ?.filter((entity) => entity.entityId !== entityId)
    .map((entity) => ({
      ...entity,
      demo: isDemoTrustedEntity ? true : entity.demo,
    }))

  const onPressVerifiedIssuer = withHaptics(() => {
    const searchParams = new URLSearchParams({
      trustedEntities: JSON.stringify(trustedEntitiesWithoutSelf?.slice(1) ?? []),
      trustMechanism,
      isDemoTrustedEntity: `${isDemoTrustedEntity}`,
    })

    if (logo?.url) searchParams.set('logo', encodeURIComponent(logo.url))
    if (name) searchParams.set('name', name)

    router.push(`trust?${searchParams}`)
  })

  const onPressInteraction = withHaptics(() => {
    router.push(`/activity?entityId=${entityId}`)
  })

  return (
    <YStack gap="$4">
      {trustMechanism === 'zada_x509' && trustedEntitiesWithoutSelf && trustedEntitiesWithoutSelf.length > 0 ? (
        // Cryptographic ZADA trust: the party's x5c chain validated against the certificate ZADA
        // published for it in the trust registry, so its signing key is bound to that entry.
        // This is the only state that may claim ZADA verified the organisation.
        <InfoButton
          variant="positive"
          title={t({
            id: 'verifyPartySlide.zadaVerifiedTitle',
            message: 'Verified by ZADA Network',
          })}
          description={t({
            id: 'verifyPartySlide.zadaVerifiedDescription',
            message: 'Identity cryptographically verified against the ZADA Trust Registry',
          })}
          onPress={onPressVerifiedIssuer}
        />
      ) : trustMechanism === 'zada_registry' && trustedEntitiesWithoutSelf && trustedEntitiesWithoutSelf.length > 0 ? (
        // Registry-listing-only trust: the issuer URL is in the ZADA trust registry, but its
        // metadata was not cryptographically signed. Surfaced distinctly (not the green
        // "verified" badge) and honestly labelled.
        <InfoButton
          variant="info"
          title={t({
            id: 'verifyPartySlide.zadaRegistryTitle',
            message: 'In ZADA Trust Registry',
          })}
          description={t({
            id: 'verifyPartySlide.zadaRegistryDescription',
            message: 'Listed in the registry, identity not cryptographically verified',
          })}
          onPress={onPressVerifiedIssuer}
        />
      ) : trustedEntitiesWithoutSelf && (trustedEntitiesWithoutSelf.length > 0 || entityIsTrustAnchor) ? (
        <InfoButton
          variant={entityIsTrustAnchor ? 'positive' : 'info'}
          title={t({
            id: 'verifyPartySlide.recognizedOrganizationTitle',
            message: 'Recognized organization',
          })}
          description={t({
            id: 'verifyPartySlide.approvedByMultipleOrganizations',
            message: `Approved by ${trustedEntitiesWithoutSelf[0].organizationName} organizations`,
          })}
          onPress={onPressVerifiedIssuer}
        />
      ) : trustMechanism === 'zada_unavailable' ? (
        // We could not reach the ZADA trust registry and the copy on this device is too old to
        // rely on, so we do not know whether this party is a member. Saying "not verified" here
        // would be a claim we cannot support — this state says what is actually true.
        <InfoButton
          variant="warning"
          title={t({
            id: 'verifyPartySlide.zadaUnavailableTitle',
            message: 'Could not check with ZADA',
          })}
          description={t({
            id: 'verifyPartySlide.zadaUnavailableDescription',
            message: 'No connection to the ZADA Trust Registry, so this organisation could not be confirmed',
          })}
          onPress={onPressVerifiedIssuer}
        />
      ) : (
        <InfoButton
          variant="warning"
          title={t(commonMessages.unknownOrganization)}
          description={t({
            id: 'verifyPartySlide.unknownOrganizationDescription',
            message: 'Organization is not verified',
          })}
          onPress={onPressVerifiedIssuer}
        />
      )}
      {isDemoTrustedEntity && (
        <InfoButton
          variant="warning"
          title={t({
            id: 'verifyPartySlide.demoTrustedEntityTitle',
            message: 'Demo organization',
          })}
          description={t({
            id: 'verifyPartySlide.demoTrustedEntityDescription',
            message: 'Do not share real data',
          })}
        />
      )}
      <InfoButton
        variant={lastInteractionDate ? 'interaction-success' : 'interaction-new'}
        title={
          lastInteractionDate
            ? t({
                id: 'verifyPartySlide.hasPreviousInteractionsTitle',
                message: 'Previous interactions',
              })
            : t({
                id: 'verifyPartySlide.hasNoPreviousInteractionsTitle',
                message: 'First time interaction',
              })
        }
        description={
          lastInteractionDate
            ? t({
                id: 'verifyPartySlide.hasPreviousInteractionsDescription',
                message: `Last interaction: ${formatRelativeDate(new Date(lastInteractionDate))}`,
              })
            : t({
                id: 'verifyPartySlide.hasNoPreviousInteractionsDescription',
                message: 'No previous interactions found',
              })
        }
        onPress={lastInteractionDate ? onPressInteraction : undefined}
      />
    </YStack>
  )
}
