import { getColdCredential } from '@easypid/hooks/useShareCredential'
import { useLingui } from '@lingui/react/macro'
import { type CredentialForDisplayId, useCredentialForDisplayById } from '@package/agent'
import {
  CredentialAttributes,
  DeleteCredentialSheet,
  FunkeCredentialCard,
  TextBackButton,
} from '@package/app/components'
import { useHaptics, useHeaderRightAction, useScrollViewPosition } from '@package/app/hooks'
import {
  FlexPage,
  HeaderContainer,
  HeroIcons,
  Loader,
  ScrollView,
  type ScrollViewRefType,
  useToastController,
  YStack,
} from '@package/ui'
import { useLocalSearchParams, useRouter } from 'expo-router'
import * as Sharing from 'expo-sharing'
import { useRef, useState } from 'react'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

export function FunkeCredentialDetailAttributesScreen() {
  const { id } = useLocalSearchParams<{ id: CredentialForDisplayId }>()
  const { credential } = useCredentialForDisplayById(id)

  const toast = useToastController()
  const router = useRouter()

  const { handleScroll, isScrolledByOffset, scrollEventThrottle } = useScrollViewPosition()

  const { bottom } = useSafeAreaInsets()
  const { withHaptics } = useHaptics()

  const [isSheetOpen, setIsSheetOpen] = useState(false)
  const [isSharing, setIsSharing] = useState(false)

  const scrollViewRef = useRef<ScrollViewRefType>(null)
  const { t } = useLingui()

  const handleShare = async () => {
    if (!credential || isSharing) return

    try {
      setIsSharing(true)
      // Get (or create) the ZADA-signed offline PDF. Reuses the on-device copy if present;
      // otherwise trust-bound-roots verifies the credential and returns the cold copy to render.
      const result = await getColdCredential(credential)
      setIsSharing(false)

      if (result.error) {
        const message =
          result.error === 'offline'
            ? t({ id: 'credentials.cold.offline', message: 'You’re offline. Connect once to create your offline copy.' })
            : result.error === 'untrusted'
              ? t({ id: 'credentials.cold.untrusted', message: 'This issuer isn’t recognised for offline copies yet.' })
              : t({ id: 'credentials.cold.failed', message: 'Couldn’t create the offline copy. Please try again.' })
        toast.show(message, { customData: { preset: 'danger' } })
        return
      }

      if (result.created) {
        toast.show(t({ id: 'credentials.cold.ready', message: 'Offline copy ready' }), { customData: { preset: 'success' } })
      }
      await new Promise((resolve) => setTimeout(resolve, 100))
      await Sharing.shareAsync(result.path)
    } catch (_e) {
      setIsSharing(false)
    }
  }

  useHeaderRightAction({
    actions: [
      {
        icon: <HeroIcons.Share />,
        onPress: withHaptics(handleShare),
      },
      {
        icon: <HeroIcons.Trash />,
        onPress: withHaptics(() => setIsSheetOpen(true)),
        renderCondition: credential?.category?.canDeleteCredential ?? true,
      },
    ],
  })

  if (!credential) {
    toast.show(
      t({
        id: 'credentials.noAttributes',
        message: 'No attributes found',
      }),
      {
        customData: { preset: 'danger' },
      }
    )
    router.back()
    return null
  }

  return (
    <YStack fg={1} bg="$background">
      <FlexPage gap="$0" paddingHorizontal="$0">
        <ScrollView ref={scrollViewRef} onScroll={handleScroll} scrollEventThrottle={scrollEventThrottle}>
          <YStack pt="$2" px="$2" jc="center" ai="center">
            <HeaderContainer
              isScrolledByOffset={isScrolledByOffset}
              title={t({
                id: 'credentials.cardAttributes',
                message: 'Credential Details',
              })}
            />
          </YStack>

          <YStack px="$4" gap="$4" marginBottom={bottom}>
            <FunkeCredentialCard
              issuerImage={{
                url: credential.display.issuer.logo?.url,
                altText: credential.display.issuer.logo?.altText,
              }}
              textColor={credential.display.textColor}
              name={credential.display.name}
              backgroundImage={{
                url: credential.display.backgroundImage?.url,
                altText: credential.display.backgroundImage?.altText,
              }}
              bgColor={credential.display.backgroundColor}
            />

            <CredentialAttributes
              key="shareable-attributes"
              headerTitle={t({
                id: 'credentials.shareableAttributes',
                message: 'Shareable attributes',
              })}
              attributes={credential.attributes}
              scrollRef={scrollViewRef}
            />
          </YStack>
        </ScrollView>

        <YStack btw="$0.5" borderColor="$grey-200" pt="$4" mx="$-4" px="$4" bg="$background">
          <TextBackButton />
        </YStack>
      </FlexPage>

      <DeleteCredentialSheet
        isSheetOpen={isSheetOpen}
        setIsSheetOpen={setIsSheetOpen}
        id={credential.id}
        name={credential.display.name}
      />

      {isSharing && (
        <YStack position="absolute" top={0} left={0} right={0} bottom={0} bg="rgba(0,0,0,0.3)" jc="center" ai="center">
          <Loader size="large" />
        </YStack>
      )}
    </YStack>
  )
}
