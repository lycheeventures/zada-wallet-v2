import { Trans, useLingui } from '@lingui/react/macro'
import { type CredentialForDisplay, type DisplayImage, useCredentialsForDisplay } from '@package/agent'
import { type CredentialCategoryTheme, getCredentialCategory, TextBackButton } from '@package/app'
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

  // Category order (identity first) keeps the most-used cards on top. Sections only appear once
  // the wallet is big enough that a flat stack gets slow to scan — below that, headers with one
  // card each would be more chrome than signal. Search results always render flat.
  const categorizedCredentials = useMemo(() => {
    return filteredCredentials
      .map((credential) => ({
        credential,
        category: getCredentialCategory({ type: credential.metadata.type, name: credential.display.name }),
      }))
      .sort((a, b) => a.category.order - b.category.order)
  }, [filteredCredentials])

  const sections = useMemo(() => {
    if (credentials.length <= 6 || searchQuery) return null
    const byCategory = new Map<string, { category: CredentialCategoryTheme; items: typeof categorizedCredentials }>()
    for (const entry of categorizedCredentials) {
      const section = byCategory.get(entry.category.id) ?? { category: entry.category, items: [] }
      section.items.push(entry)
      byCategory.set(entry.category.id, section)
    }
    return Array.from(byCategory.values())
  }, [categorizedCredentials, credentials.length, searchQuery])

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
            // Larger cards fanned out and stacked in front of each other (each overlaps the
            // previous), tap one to open it. The overlap leaves each card's white banner (logo +
            // name) visible. With enough cards, they split into category sections instead.
            <YStack fg={1} pb="$12">
              {sections
                ? sections.map((section, sectionIndex) => (
                    <YStack key={section.category.id} mt={sectionIndex === 0 ? 0 : '$6'}>
                      <CategorySectionHeader category={section.category} />
                      {section.items.map(({ credential }, index) => (
                        <CredentialStackItem
                          key={credential.id}
                          credential={credential}
                          index={index}
                          onPress={() => pushToCredential(credential.id)}
                        />
                      ))}
                    </YStack>
                  ))
                : categorizedCredentials.map(({ credential }, index) => (
                    <CredentialStackItem
                      key={credential.id}
                      credential={credential}
                      index={index}
                      onPress={() => pushToCredential(credential.id)}
                    />
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

function CategorySectionHeader({ category }: { category: CredentialCategoryTheme }) {
  const { t } = useLingui()
  const CategoryIcon = category.icon
  return (
    <XStack ai="center" gap="$2" mb="$3">
      <CategoryIcon size={16} strokeWidth={2.5} color={category.color ?? '#5F5E5A'} />
      <Paragraph fontSize={13} fontWeight="$semiBold" color="$grey-700">
        {t(category.label)}
      </Paragraph>
    </XStack>
  )
}

function CredentialStackItem({
  credential,
  index,
  onPress,
}: {
  credential: CredentialForDisplay
  index: number
  onPress: () => void
}) {
  return (
    <YStack mt={index === 0 ? 0 : -120} zIndex={index}>
      <FunkeCredentialCard
        name={credential.display.name}
        issuerName={credential.display.issuer.name}
        credentialType={credential.metadata.type}
        issuedAt={credential.metadata.issuedAt ? new Date(credential.metadata.issuedAt) : credential.createdAt}
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
        onPress={onPress}
      />
    </YStack>
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
