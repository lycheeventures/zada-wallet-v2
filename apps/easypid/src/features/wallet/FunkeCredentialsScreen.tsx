import { Trans, useLingui } from '@lingui/react/macro'
import { type DisplayImage, useCredentialsForDisplay } from '@package/agent'
import { TextBackButton } from '@package/app'
import { FunkeCredentialCard } from '@package/app/components'
import { useHaptics, useScrollViewPosition } from '@package/app/hooks'
import {
  AnimatedStack,
  FlexPage,
  getTextColorBasedOnBg,
  HeaderContainer,
  Heading,
  HeroIcons,
  IconContainer,
  Image,
  Input,
  Loader,
  LucideIcons,
  Paragraph,
  pickCredentialBackgroundColor,
  ScrollView,
  Spacer,
  Stack,
  useScaleAnimation,
  XStack,
  YStack,
} from '@package/ui'
import { formatDate } from '@package/utils'
import { useRouter } from 'expo-router'
import { useMemo, useState } from 'react'
import { FadeInDown } from 'react-native-reanimated'

export function FunkeCredentialsScreen() {
  const { credentials, isLoading: isLoadingCredentials } = useCredentialsForDisplay()

  const [searchQuery, setSearchQuery] = useState('')
  const filteredCredentials = useMemo(() => {
    return credentials.filter((credential) => credential.display.name.toLowerCase().includes(searchQuery.toLowerCase()))
  }, [credentials, searchQuery])

  const { handleScroll, isScrolledByOffset, scrollEventThrottle } = useScrollViewPosition()
  const { push } = useRouter()
  const { withHaptics } = useHaptics()

  const { t } = useLingui()
  const pushToCredential = withHaptics((id: string) => push(`/credentials/${id}`))

  return (
    <FlexPage gap="$0" paddingHorizontal="$0">
      <HeaderContainer
        title={t({
          id: 'credentials.title',
          message: 'Cards',
          comment: 'Heading for the list of user credentials',
        })}
        isScrolledByOffset={isScrolledByOffset}
      />

      {credentials.length === 0 ? (
        <AnimatedStack
          flexDirection="column"
          entering={FadeInDown.delay(300).springify().mass(1).damping(16).stiffness(140).restSpeedThreshold(0.1)}
          gap="$2"
          jc="center"
          p="$4"
          fg={1}
        >
          <Heading ta="center" heading="h3" fontWeight="$semiBold">
            <Trans id="credentials.emptyTitle" comment="Shown when the user has no credentials">
              You don’t have any credentials yet
            </Trans>
          </Heading>
          <Paragraph ta="center" px="$2">
            <Trans id="credentials.emptyDescription" comment="Subtext explaining that credentials will appear later">
              Credentials will appear here once you receive them.
            </Trans>
          </Paragraph>
        </AnimatedStack>
      ) : isLoadingCredentials ? (
        <YStack fg={1} ai="center" jc="center">
          <Loader />
          <Spacer size="$12" />
        </YStack>
      ) : (
        <ScrollView px="$4" onScroll={handleScroll} scrollEventThrottle={scrollEventThrottle}>
          <Stack position="relative">
            <Input
              value={searchQuery}
              onChangeText={setSearchQuery}
              pl="$7"
              mb="$4"
              bg="$grey-50"
              placeholderTextColor="$grey-500"
              borderColor="$borderTranslucent"
              placeholder={t({
                id: 'common.search',
                message: 'Search cards',
                comment: 'Placeholder for search input in credentials list',
              })}
            />
            <HeroIcons.MagnifyingGlass
              size={20}
              strokeWidth={2.5}
              color="$grey-400"
              position="absolute"
              top={12} // Positions icon in the middle of standard input height
              left="$3"
            />
          </Stack>
          {filteredCredentials.length > 0 ? (
            // Larger cards fanned out and stacked in front of each other (each overlaps the previous),
            // tap one to open it.
            <YStack fg={1} pb="$12">
              {filteredCredentials.map((credential, index) => (
                <YStack key={credential.id} mt={index === 0 ? 0 : -120} zIndex={index}>
                  <FunkeCredentialCard
                    name={credential.display.name}
                    textColor={credential.display.textColor}
                    bgColor={credential.display.backgroundColor}
                    issuerImage={{
                      url: credential.display.issuer.logo?.url,
                      altText: credential.display.issuer.logo?.altText,
                    }}
                    backgroundImage={{
                      url: credential.display.backgroundImage?.url,
                      altText: credential.display.backgroundImage?.altText,
                    }}
                    onPress={() => pushToCredential(credential.id)}
                  />
                </YStack>
              ))}
            </YStack>
          ) : (
            <Paragraph mt="$8" ta="center">
              <Trans id="common.noResultsSearch" comment="Shown when search yields no results; includes query string">
                No cards found for "{searchQuery}"
              </Trans>
            </Paragraph>
          )}
        </ScrollView>
      )}

      <YStack btw="$0.5" borderColor="$grey-200" pt="$4" mx="$-4" px="$4" bg="$background">
        <TextBackButton />
      </YStack>
    </FlexPage>
  )
}

interface FunkeCredentialRowCardProps {
  name: string
  backgroundColor?: string
  textColor?: string
  issuer: string
  logo?: DisplayImage
  issuedAt?: Date
  onPress?: () => void
}

export function FunkeCredentialRowCard({
  name,
  backgroundColor,
  textColor,
  logo,
  issuedAt,
  onPress,
}: FunkeCredentialRowCardProps) {
  const { pressStyle, handlePressIn, handlePressOut } = useScaleAnimation({ scaleInValue: 0.99 })

  // Match FunkeCredentialCard: fall back to a deterministic palette colour (seeded by name) when the
  // issuer provides no background colour. Only honour an issuer text colour when we also use the
  // issuer's background; otherwise derive a readable one from the palette colour.
  const bg = backgroundColor ?? pickCredentialBackgroundColor(name)
  const resolvedTextColor = backgroundColor && textColor ? textColor : getTextColorBasedOnBg(bg)

  const icon = logo?.url ? (
    <Image src={logo.url} width={36} height={36} />
  ) : (
    <XStack width={36} height={36} bg="$lightTranslucent" ai="center" jc="center" br="$12">
      <LucideIcons.FileBadge size={20} strokeWidth={2.5} color="$grey-100" />
    </XStack>
  )

  return (
    <AnimatedStack
      flexDirection="row"
      bg={bg}
      gap="$4"
      ai="center"
      borderWidth="$0.5"
      borderColor="$borderTranslucent"
      br="$6"
      p="$4"
      style={pressStyle}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={onPress}
      fg={1}
    >
      {icon}
      <YStack gap="$1" jc="center" fg={1} f={1}>
        <Paragraph mt="$-1.5" fontSize={14} fontWeight="$bold" color={resolvedTextColor} numberOfLines={1}>
          {name.toLocaleUpperCase()}
        </Paragraph>
        {issuedAt && (
          <Paragraph variant="sub" opacity={0.9} color={resolvedTextColor}>
            <Trans id="common.issuedOn" comment="Label before the date a credential was issued">
              Issued on {formatDate(issuedAt, { includeTime: false })}
            </Trans>
          </Paragraph>
        )}
      </YStack>
      {onPress && (
        <IconContainer bg="transparent" icon={<HeroIcons.ArrowRight color={resolvedTextColor} size={20} />} />
      )}
    </AnimatedStack>
  )
}
