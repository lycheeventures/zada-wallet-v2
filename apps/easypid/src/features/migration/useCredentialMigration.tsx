import { useLingui } from '@lingui/react/macro'
import { useToastController } from '@package/ui'
import * as WebBrowser from 'expo-web-browser'
import { credentialMigrationUrl } from '../../constants'
import { mmkv } from '../../storage/mmkv'

/**
 * MMKV flag set once the user has begun ZADA ID onboarding / credential migration. Both the
 * "Migrate credentials" and "Create ZADA ID" home actions run this same flow, so starting either
 * one hides both getting-started buttons (you only set up your ZADA ID once). Read on the home
 * screen via `useMMKVBoolean('hasZadaIdOnboarded', mmkv)`.
 */
export const HAS_ZADA_ID_ONBOARDED_KEY = 'hasZadaIdOnboarded'

/**
 * MMKV flag set by the final onboarding step ("Set up your ZADA ID"). Onboarding finishes by
 * replacing the route with the dashboard, so the step can't push the flow itself; the dashboard
 * reads this flag on mount, clears it, and opens `/zada-id`.
 */
export const ZADA_ID_SETUP_PENDING_KEY = 'zadaIdSetupPending'

/**
 * FALLBACK: run the ZADA ID / credential-migration flow in the credential-key-usher web app
 * (in-app browser).
 *
 * The primary path is now the native flow in `features/zada-id` (route `/zada-id`), which runs the
 * same steps in-app against the usher's `/api/v1`. This hook remains for when that API can't be
 * reached: the web flow verifies phone/email there, and the batch deep link
 * (`/wallet/credential-offer-batch?batch=…`) re-opens the wallet, where `MigrateBatchScreen`
 * receives the credentials. See ADR-0002 / credential-key-usher.
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
      // The user has committed to ZADA ID onboarding — hide the getting-started buttons for both
      // "Migrate" and "Create ZADA ID" from now on.
      mmkv.set(HAS_ZADA_ID_ONBOARDED_KEY, true)
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
