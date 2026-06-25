import { useMemo, useState } from 'react'
import { Trans, useLingui } from '@lingui/react/macro'
import { useCredentialsForDisplay } from '@package/agent'
import { useHaptics } from '@package/app/hooks'
import {
  CustomIcons,
  FlexPage,
  HeroIcons,
  IconContainer,
  Loader,
  Paragraph,
  XStack,
  YStack,
  ScrollView,
  Stack,
  Input,
} from '@package/ui'
import { useRouter } from 'expo-router'
import { InboxIcon } from './components/InboxIcon'
import { useScrollViewPosition } from '@package/app/hooks'
import { FunkeCredentialCard } from '@package/app/components'

export function FunkeWalletScreen() {
  const { push } = useRouter()
  const { withHaptics } = useHaptics()
  const { handleScroll, scrollEventThrottle } =
    useScrollViewPosition()
  const {
    credentials,
    isLoading: isLoadingCredentials,
  } = useCredentialsForDisplay()
  const [searchQuery, setSearchQuery] = useState('')
  const filteredCredentials = useMemo(() => {
    return credentials.filter((credential) =>
      credential.display.name
        .toLowerCase()
        .includes(searchQuery.toLowerCase())
    )
  }, [credentials, searchQuery])

  const pushToMenu = withHaptics(() => push('/menu'))
  const pushToScanner = withHaptics(() => push('/scan'))
  const { t } = useLingui()

  return (
    <YStack fg={1} bg="$background">
      <FlexPage fg={1} flex-1={false} bg="transparent">
        <XStack pt="$6" px="$2" jc="space-between" ai="center">
          <IconContainer
            bg="white"
            aria-label="Menu"
            icon={<HeroIcons.Menu />}
            onPress={pushToMenu}
          />
          <Paragraph
            fontSize={18}
            fontWeight="$bold"
            color="$grey-500"
            numberOfLines={1}
            >
            {credentials.length === 0 ? 'ZADA' : 'Credential List'}
          </Paragraph>
          <InboxIcon />
        </XStack>
        {isLoadingCredentials ? (
          <YStack ai="center" jc="center" mt="$6">
            <Loader />
          </YStack>
        ) : credentials.length === 0 ? (
          <YStack ai="center" jc="center" mt="$10" px="$6">
            <HeroIcons.Folder
              size={64}
              strokeWidth={1.5}
              color="$grey-400"
            />
            <Paragraph
              mt="$2"
              color="$grey-500"
              ta="center"
            >
              <Trans id="wallet.emptyCredentials">
               You don’t have any credentials yet. Scan a QR code to add your first credential.
              </Trans>
            </Paragraph>
          </YStack>
        ) : (
          <ScrollView
            onScroll={handleScroll}
            scrollEventThrottle={scrollEventThrottle}
            contentContainerStyle={{ paddingBottom: 140 }}
            showsVerticalScrollIndicator={false}
          >
            <Stack position="relative" px="$2">
              <Input
                value={searchQuery}
                onChangeText={(e) =>
                  setSearchQuery(
                    typeof e === 'string'
                      ? e
                      : e.nativeEvent.text
                  )
                }
                pl="$7"
                mb="$6"
                bg="$grey-50"
                placeholderTextColor="$grey-500"
                borderColor="$borderTranslucent"
                placeholder={t({
                  id: 'common.search',
                  message: 'Search cards',
                })}
              />
              <HeroIcons.MagnifyingGlass
                size={20}
                strokeWidth={2.5}
                color="$grey-400"
                position="absolute"
                top={12}
                left="$4"
              />
            </Stack>
            {filteredCredentials.length > 0 ? (
              <YStack px="$2" pb="$12">
                {filteredCredentials.map((credential, index) => (
                  <YStack
                    key={credential.id}
                    mt={index === 0 ? 0 : -120}
                    zIndex={index}
                  >
                    <FunkeCredentialCard
                      issuerImage={{
                        url: credential.display.issuer.logo?.url,
                        altText:
                          credential.display.issuer.logo?.altText,
                      }}
                      textColor={credential.display.textColor}
                      name={credential.display.name}
                      backgroundImage={{
                        url:
                          credential.display.backgroundImage?.url,
                        altText:
                          credential.display.backgroundImage
                            ?.altText,
                      }}
                      bgColor={
                        credential.display.backgroundColor ??
                        '$grey-900'
                      }
                      onPress={() =>
                        push(
                          `/credentials/${credential.id}/attributes`
                        )
                      }
                    />
                  </YStack>
                ))}
              </YStack>
            ) : (
              <YStack ai="center" mt="$10" px="$6">
                <HeroIcons.MagnifyingGlass
                  size={48}
                  strokeWidth={1.5}
                  color="$grey-400"
                />
                <Paragraph mt="$2" color="$grey-500" ta="center">
                  <Trans id="search.noResults">
                      No credentials found
                   </Trans>
                </Paragraph>
              </YStack>
            )}
          </ScrollView>
        )}
      </FlexPage>
      <XStack
        position="absolute"
        bottom="$10"
        left={0}
        right={0}
        jc="center"
      >
        <XStack
          ai="center"
          gap="$2"
          px="$5"
          py="$3"
          br="$10"
          bg="$primary-500"
          onPress={pushToScanner}
          pressStyle={{ opacity: 0.8 }}
        >
          <CustomIcons.Qr size={28} color="$white" />
          <Paragraph color="$white" fontWeight="$bold">
             <Trans id="home.scanButton">
              Scan
             </Trans>
          </Paragraph>
        </XStack>
      </XStack>
    </YStack>
  )
}