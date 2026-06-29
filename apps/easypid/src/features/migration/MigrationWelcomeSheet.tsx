import { useLingui } from '@lingui/react/macro'
import { Button, FloatingSheet, Heading, HeroIcons, Paragraph, Stack } from '@package/ui'
import { useEffect, useState } from 'react'
import { useMMKVBoolean } from 'react-native-mmkv'
import { Circle } from 'tamagui'
import { mmkv } from '../../storage/mmkv'
import { useCredentialMigration } from './useCredentialMigration'

/**
 * One-time welcome shown on first use of the app. Introduces ZADA ID and offers to bring over
 * existing credentials by verifying a phone number (-> credential migration), or to skip for
 * first-time ZADA users. The "seen" flag is persisted in MMKV so it only appears once.
 */
export function MigrationWelcomeSheet() {
  const { t } = useLingui()
  const { startMigration } = useCredentialMigration()
  const [hasSeenWelcome, setHasSeenWelcome] = useMMKVBoolean('hasSeenMigrationWelcome', mmkv)
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    // undefined (never set) or false → first use, show the welcome.
    if (!hasSeenWelcome) setIsOpen(true)
  }, [hasSeenWelcome])

  const markSeenAndClose = () => {
    setHasSeenWelcome(true)
    setIsOpen(false)
  }

  const onVerify = async () => {
    markSeenAndClose()
    await startMigration()
  }

  return (
    <FloatingSheet isOpen={isOpen} setIsOpen={setIsOpen} onDismiss={markSeenAndClose}>
      <Stack ai="center" jc="center" h="$12" bg="$primary-300">
        <Circle bg="$primary-400" p="$2.5">
          <Circle bg="$primary-500" size="$5">
            <HeroIcons.Identification size={32} color="$white" />
          </Circle>
        </Circle>
      </Stack>
      <Stack gap="$3" p="$4">
        <Heading color="$grey-900" heading="h2">
          {t({
            id: 'migrationWelcome.title',
            message: 'Welcome to ZADA ID',
            comment: 'Title of the first-launch welcome sheet',
          })}
        </Heading>
        <Paragraph>
          {t({
            id: 'migrationWelcome.body',
            message:
              'This is your new ZADA ID app for managing digital credentials from different issuers. To get started, verify your phone number to bring over your existing credentials — or skip if this is your first time with ZADA.',
            comment: 'Body text of the first-launch welcome sheet',
          })}
        </Paragraph>
        <Stack />
        <Button.Solid scaleOnPress onPress={onVerify}>
          {t({
            id: 'migrationWelcome.verify',
            message: 'Verify phone number',
            comment: 'Primary action: start credential migration by verifying a phone number',
          })}
        </Button.Solid>
        <Button.Text scaleOnPress onPress={markSeenAndClose}>
          {t({
            id: 'migrationWelcome.skip',
            message: 'Skip',
            comment: 'Secondary action: skip migration (first-time ZADA user)',
          })}
        </Button.Text>
      </Stack>
    </FloatingSheet>
  )
}
