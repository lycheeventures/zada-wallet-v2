import { useLingui } from '@lingui/react/macro'
import { useHaptics, useScrollViewPosition } from '@package/app/hooks'
import {
  AnimatedStack,
  FlexPage,
  HeaderContainer,
  Heading,
  HeroIcons,
  IconContainer,
  type IconContainerProps,
  Paragraph,
  ScrollView,
  useScaleAnimation,
  YStack,
} from '@package/ui'
import { router } from 'expo-router'

function DocumentRow({
  icon,
  title,
  subtitle,
  onPress,
}: {
  icon: IconContainerProps['icon']
  title: string
  subtitle: string
  onPress: () => void
}) {
  const { pressStyle, handlePressIn, handlePressOut } = useScaleAnimation()
  return (
    <AnimatedStack
      style={pressStyle}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={onPress}
      flexDirection="row"
      ai="center"
      gap="$3"
      bg="$white"
      br="$6"
      p="$3.5"
      borderWidth="$0.5"
      borderColor="$borderTranslucent"
    >
      <IconContainer icon={icon} radius="normal" />
      <YStack f={1} fg={1}>
        <Heading heading="h3" fontWeight="$semiBold" color="$grey-900">
          {title}
        </Heading>
        <Paragraph variant="sub" color="$grey-600" numberOfLines={1}>
          {subtitle}
        </Paragraph>
      </YStack>
      <HeroIcons.ChevronRight color="$grey-500" />
    </AnimatedStack>
  )
}

/**
 * Catalog of official documents the wallet can turn into verified credentials. Each row states
 * how the document is captured (NFC chip, QR code, …) and routes to its own flow. New document
 * types = one more row here + a source entry in documentSources.ts (matching the issuer's
 * allow-list).
 */
export function DocumentCatalogScreen() {
  const { t } = useLingui()
  const { withHaptics } = useHaptics()
  const { handleScroll, isScrolledByOffset, scrollEventThrottle } = useScrollViewPosition()

  const handlePush = (path: string) => withHaptics(() => router.push(path))

  return (
    <FlexPage gap="$0" paddingHorizontal="$0">
      <HeaderContainer
        isScrolledByOffset={isScrolledByOffset}
        title={t({
          id: 'documentCatalog.title',
          message: 'Add a document',
          comment: 'Title of the official-document catalog screen',
        })}
      />
      <ScrollView onScroll={handleScroll} scrollEventThrottle={scrollEventThrottle}>
        <YStack gap="$3" px="$4">
          <Paragraph color="$grey-600">
            {t({
              id: 'documentCatalog.subtitle',
              message: 'Turn a physical document into a verified credential in your wallet.',
              comment: 'Subtitle of the official-document catalog screen',
            })}
          </Paragraph>
          <YStack gap="$2">
            <DocumentRow
              icon={<HeroIcons.IdentificationFilled color="$primary-500" />}
              title={t({ id: 'documentCatalog.passport', message: 'Passport' })}
              subtitle={t({
                id: 'documentCatalog.passportSubtitle',
                message: 'Read the chip in your passport with your phone',
              })}
              onPress={handlePush('/passport')}
            />
            <DocumentRow
              icon={<HeroIcons.CreditCardFilled color="$primary-500" />}
              title={t({ id: 'documentCatalog.mdl', message: 'Myanmar driver license' })}
              subtitle={t({
                id: 'documentCatalog.mdlSubtitle',
                message: 'Scan the QR code on your license',
              })}
              onPress={handlePush('/documents/mdl')}
            />
          </YStack>
          <Paragraph variant="sub" ta="center" color="$grey-500" py="$2">
            {t({
              id: 'documentCatalog.moreSoon',
              message: 'More documents coming soon',
              comment: 'Hint at the bottom of the document catalog',
            })}
          </Paragraph>
        </YStack>
      </ScrollView>
    </FlexPage>
  )
}
