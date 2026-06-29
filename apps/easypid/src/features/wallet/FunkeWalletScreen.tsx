import { Trans, useLingui } from '@lingui/react/macro'
import { useHaptics } from '@package/app/hooks'
import {
  AnimatedStack,
  Blob,
  CustomIcons,
  FlexPage,
  Heading,
  HeroIcons,
  IconContainer,
  type IconContainerProps,
  Paragraph,
  ScrollView,
  Spacer,
  Stack,
  useScaleAnimation,
  useSpringify,
  XStack,
  YStack,
} from '@package/ui'
import { useRouter } from 'expo-router'
import { useMMKVBoolean } from 'react-native-mmkv'
import { FadeIn } from 'react-native-reanimated'
import { mmkv } from '../../storage/mmkv'
import { MigrationWelcomeSheet } from '../migration/MigrationWelcomeSheet'
import { HAS_ZADA_ID_ONBOARDED_KEY, useCredentialMigration } from '../migration/useCredentialMigration'
import { ActionCard } from './components/ActionCard'
import { AllCardsCard } from './components/AllCardsCard'
import { InboxIcon } from './components/InboxIcon'
import { LatestActivityCard } from './components/LatestActivityCard'

const HAS_ADDED_PASSPORT_KEY = 'hasAddedPassport'

/**
 * A dismiss-after-first-use row in the "Get started" section. Each routes to a setup flow and then
 * hides itself (the action stays reachable from the menu/settings), so the home screen declutters
 * as the user finishes onboarding.
 */
function GetStartedItem({
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

export function FunkeWalletScreen() {
  const { push } = useRouter()
  const { withHaptics } = useHaptics()
  const { t } = useLingui()
  const { startMigration } = useCredentialMigration()

  // Getting-started buttons disappear after first use. Migrate + Create ZADA ID share one flag
  // because they run the same onboarding flow; passport tracks its own.
  const [hasAddedPassport] = useMMKVBoolean(HAS_ADDED_PASSPORT_KEY, mmkv)
  const [hasZadaIdOnboarded] = useMMKVBoolean(HAS_ZADA_ID_ONBOARDED_KEY, mmkv)

  const pushToMenu = withHaptics(() => push('/menu'))
  const pushToScanner = withHaptics(() => push('/scan'))
  const pushToOffline = withHaptics(() => push('/offline'))

  const onAddPassport = withHaptics(() => {
    mmkv.set(HAS_ADDED_PASSPORT_KEY, true)
    push('/passport')
  })
  // Both "Create ZADA ID" (new users) and "Migrate" (existing users) run the same flow;
  // startMigration persists HAS_ZADA_ID_ONBOARDED_KEY, which hides both buttons.
  const onZadaIdOnboard = withHaptics(() => startMigration())

  const showPassport = !hasAddedPassport
  const showZadaId = !hasZadaIdOnboarded
  const showGetStarted = showPassport || showZadaId

  return (
    <YStack pos="relative" fg={1} bg="$background">
      <MigrationWelcomeSheet />
      <YStack pos="absolute" h="50%" w="100%">
        <Blob />
      </YStack>

      <FlexPage fg={1} flex-1={false} bg="transparent">
        <XStack pt="$2" jc="space-between">
          <IconContainer bg="white" aria-label="Menu" icon={<HeroIcons.Menu />} onPress={pushToMenu} />
          <InboxIcon />
        </XStack>

        <AnimatedStack fg={1} entering={useSpringify(FadeIn, 200)}>
          <ScrollView contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
            <YStack fg={1} gap="$4">
              <YStack ai="center" jc="center" gap="$2" pt="$2">
                <Heading heading="h1" fontSize={38} lineHeight={40} ta="center">
                  <Trans id="home.helloWithoutName">Hello!</Trans>
                </Heading>
                <Paragraph>
                  <Trans id="home.receiveOrShare">Receive or share from your wallet</Trans>
                </Paragraph>
              </YStack>

              <XStack gap="$4" jc="center" py="$2" w="95%" mx="auto">
                <ActionCard
                  variant="primary"
                  icon={<CustomIcons.Qr color="white" />}
                  title={t({ id: 'home.scanQrButton', message: 'Scan QR-code' })}
                  onPress={pushToScanner}
                />
                <ActionCard
                  variant="secondary"
                  icon={<CustomIcons.People size={26} />}
                  title={t({ id: 'home.presentInPersonButton', message: 'Present In-person' })}
                  onPress={pushToOffline}
                />
              </XStack>

              {showGetStarted && (
                <YStack gap="$3">
                  <Heading heading="sub2" fontWeight="$semiBold" color="$grey-700">
                    <Trans id="home.getStarted">Get started</Trans>
                  </Heading>
                  <YStack gap="$2">
                    {showZadaId && (
                      <>
                        <GetStartedItem
                          icon={<HeroIcons.Identification color="$primary-500" />}
                          title={t({ id: 'home.createZadaId', message: 'Create ZADA ID' })}
                          subtitle={t({
                            id: 'home.createZadaIdSubtitle',
                            message: 'New to ZADA? Set up your ZADA ID',
                          })}
                          onPress={onZadaIdOnboard}
                        />
                        <GetStartedItem
                          icon={<HeroIcons.ArrowPath color="$primary-500" />}
                          title={t({ id: 'home.migrate', message: 'Migrate credentials' })}
                          subtitle={t({
                            id: 'home.migrateSubtitle',
                            message: 'Bring over credentials from the old app',
                          })}
                          onPress={onZadaIdOnboard}
                        />
                      </>
                    )}
                    {showPassport && (
                      <GetStartedItem
                        icon={<HeroIcons.IdentificationFilled color="$primary-500" />}
                        title={t({ id: 'home.addPassport', message: 'Add passport' })}
                        subtitle={t({
                          id: 'home.addPassportSubtitle',
                          message: 'Scan your passport chip to add it',
                        })}
                        onPress={onAddPassport}
                      />
                    )}
                  </YStack>
                </YStack>
              )}

              <Stack h="$2" />

              <YStack gap="$4">
                <LatestActivityCard />
                <AllCardsCard />
              </YStack>
              <Spacer />
            </YStack>
          </ScrollView>
        </AnimatedStack>
      </FlexPage>
    </YStack>
  )
}
