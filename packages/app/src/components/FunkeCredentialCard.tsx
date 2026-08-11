import { Trans, useLingui } from '@lingui/react/macro'
import type { DisplayImage } from '@package/agent'
import { commonMessages } from '@package/translations'
import {
  AnimatedStack,
  Card,
  getTextColorBasedOnBg,
  HeroIcons,
  IconContainer,
  Image,
  Loader,
  LucideIcons,
  Paragraph,
  pickCredentialBackgroundColor,
  Spacer,
  Stack,
  useScaleAnimation,
  XStack,
  YStack,
} from '@package/ui'
import { formatDate } from '@package/utils'
import { BlurView } from 'expo-blur'
import { StyleSheet } from 'react-native'
import { getCredentialCategory } from '../utils/credentialCategory'
import { BlurBadge } from './BlurBadge'

type FunkeCredentialCardProps = {
  onPress?(): void
  name: string
  /** Issuing organisation name, shown under the credential name on the banner */
  issuerName?: string
  /** Credential type identifier (vct / doctype), used to resolve the display category */
  credentialType?: string
  issuedAt?: Date
  bgColor?: string
  textColor?: string
  issuerImage?: DisplayImage
  backgroundImage?: DisplayImage
  shadow?: boolean
  isLoading?: boolean
  isExpired?: boolean
  isRevoked?: boolean
}

export function FunkeCredentialCard({
  onPress,
  issuerImage,
  name,
  issuerName,
  credentialType,
  issuedAt,
  bgColor,
  textColor,
  backgroundImage,
  shadow = true,
  isLoading,
  isExpired,
  isRevoked,
}: FunkeCredentialCardProps) {
  const { pressStyle, handlePressIn, handlePressOut } = useScaleAnimation({ scaleInValue: 0.99 })
  const { t } = useLingui()

  const category = getCredentialCategory({ type: credentialType, name })
  const CategoryIcon = category.icon

  // The card body colour encodes the credential's CATEGORY, not the issuer's brand — the issuer
  // owns the white banner (logo + names) instead. Issuer colours only apply for uncategorised
  // types, then the name-seeded ZADA palette as last resort. All of these are deep colours, so
  // body text is white unless an issuer background image (which covers the body) dictates its own.
  const bodyBgColor = category.color ?? bgColor ?? pickCredentialBackgroundColor(name)
  const bodyTextColor = backgroundImage?.url
    ? (textColor ?? getTextColorBasedOnBg(bgColor ?? '#ffffff'))
    : getTextColorBasedOnBg(bodyBgColor)

  const logo = issuerImage?.url ? (
    <XStack br="$2" overflow="hidden">
      <Image src={issuerImage.url} width={32} height={32} />
    </XStack>
  ) : (
    <XStack width={32} height={32} bg="$grey-100" ai="center" jc="center" br="$2">
      <LucideIcons.FileBadge size={18} strokeWidth={2.5} color="$grey-500" />
    </XStack>
  )

  return (
    <AnimatedStack
      shadow={shadow}
      br="$8"
      bg="$white"
      borderWidth="$0.5"
      borderColor="$borderTranslucent"
      position="relative"
      overflow="hidden"
      f={1}
      style={pressStyle}
    >
      <Card
        f={1}
        br="$8"
        p={0}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        backgroundColor="transparent"
        onPress={onPress}
        overflow="hidden"
        accessible={true}
        accessibilityRole={onPress ? 'button' : undefined}
        aria-label="Credential"
      >
        <XStack bg="$white" px="$4" py="$3" ai="center" gap="$3">
          {logo}
          <YStack f={1}>
            <Paragraph fontSize={15} fontWeight="$semiBold" color="$grey-900" numberOfLines={1}>
              {name}
            </Paragraph>
            {issuerName && (
              <Paragraph fontSize={12} color="$grey-600" numberOfLines={1}>
                {issuerName}
              </Paragraph>
            )}
          </YStack>
          <CategoryIcon size={20} strokeWidth={2.5} color={category.color ?? '#5F5E5A'} />
        </XStack>
        <YStack f={1} p="$4" bg={backgroundImage?.url ? 'transparent' : bodyBgColor} position="relative">
          {backgroundImage?.url && (
            <Stack pos="absolute" top={0} left={0} right={0} bottom={0} accessible={false}>
              <Image
                backgroundColor={bgColor ?? '$grey-900'}
                src={backgroundImage.url}
                alt={backgroundImage.altText}
                width="100%"
                height="100%"
                contentFit="cover"
              />
            </Stack>
          )}
          {!backgroundImage?.url && (
            <Stack pos="absolute" right={-18} bottom={-24} accessible={false}>
              <CategoryIcon size={132} strokeWidth={1.25} color="rgba(255,255,255,0.09)" />
            </Stack>
          )}
          <Paragraph fontSize={12} fontWeight="$semiBold" color={bodyTextColor} opacity={0.75}>
            {t(category.label)}
          </Paragraph>
          <Spacer size="$9" />
          <XStack jc="space-between" ai="flex-end" h="$3">
            {issuedAt && !isLoading && !isExpired && !isRevoked ? (
              <Paragraph fontSize={12} color={bodyTextColor} opacity={0.75}>
                <Trans id="common.issuedOn" comment="Label before the date a credential was issued">
                  Issued on {formatDate(issuedAt, { includeTime: false })}
                </Trans>
              </Paragraph>
            ) : (
              <Stack />
            )}
            {onPress && <IconContainer onPress={onPress} icon={<HeroIcons.ArrowRight color={bodyTextColor} />} />}
          </XStack>
          {isLoading && (
            <XStack overflow="hidden" bg="#0000001A" br="$12" ai="center" gap="$2" bottom="$4" left="$4" pos="absolute">
              <BlurView intensity={20} tint="light" style={StyleSheet.absoluteFillObject} />
              <Loader variant="dark" />
            </XStack>
          )}
          {(isExpired || isRevoked) && (
            <Stack pos="absolute" bottom="$4" left="$4">
              <BlurBadge
                color={bodyTextColor}
                label={isExpired ? t(commonMessages.expired) : t(commonMessages.revoked)}
              />
            </Stack>
          )}
        </YStack>
      </Card>
    </AnimatedStack>
  )
}
