import { useLingui } from '@lingui/react/macro'
import { useToastController } from '@package/ui'
import * as WebBrowser from 'expo-web-browser'
import { credentialMigrationUrl } from '../../constants'

/**
 * Migrate legacy ZADA credentials via the credential-key-usher web flow.
 *
 * We hand off to the (already built and audited) web flow rather than re-implementing phone
 * verification + legacy lookup in the wallet. The user verifies their phone and picks which
 * credentials to claim there; each claim produces an `openid-credential-offer://` deep link
 * that re-opens the wallet, where the existing invitation router receives the credential.
 * See ADR-0002 / credential-key-usher.
 */
export function useCredentialMigration() {
  const { t } = useLingui()
  const toast = useToastController()

  const startMigration = async () => {
    if (!credentialMigrationUrl) {
      toast.show(
        t({
          id: 'migration.notConfigured',
          message: 'Credential migration is not available in this build.',
          comment: 'Shown when the migration URL is not configured for the current build.',
        }),
        { customData: { preset: 'danger' } }
      )
      return
    }

    try {
      // Opens an in-app browser; the claim hand-back uses the openid-credential-offer:// scheme,
      // which the OS routes to the wallet's deep-link handler.
      await WebBrowser.openBrowserAsync(credentialMigrationUrl)
    } catch (_error) {
      toast.show(
        t({
          id: 'migration.failedToOpen',
          message: 'Could not open credential migration. Please try again.',
          comment: 'Shown when the in-app browser for migration fails to open.',
        }),
        { customData: { preset: 'danger' } }
      )
    }
  }

  return { startMigration }
}
