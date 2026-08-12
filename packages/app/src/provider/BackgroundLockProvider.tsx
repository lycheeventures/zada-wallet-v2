import { useSecureUnlock } from '@package/secure-store/secure-wallet-key/SecureUnlockProvider'
import type { PropsWithChildren } from 'react'
import { useEffect, useRef } from 'react'
import { AppState, type AppStateStatus } from 'react-native'

const BACKGROUND_TIME_THRESHOLD = 60000 // 60 seconds

export function BackgroundLockProvider({ children }: PropsWithChildren) {
  const secureUnlock = useSecureUnlock()
  const backgroundTimeRef = useRef<Date | null>(null)

  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'background' || nextAppState === 'inactive') {
        backgroundTimeRef.current = new Date()
      } else if (nextAppState === 'active') {
        if (backgroundTimeRef.current) {
          const timeInBackground = Date.now() - backgroundTimeRef.current.getTime()

          if (timeInBackground > BACKGROUND_TIME_THRESHOLD && secureUnlock.state === 'unlocked') {
            console.log('App was in background for more than 60 seconds, locking')
            // Only lock — do NOT navigate. The (app) layout already redirects to /authenticate
            // whenever the wallet is locked, preserving the current route as redirectAfterUnlock.
            // A bare router.replace('/authenticate') here raced the deeplink flow and destroyed
            // its ?redirectAfterUnlock target: on iOS the in-app browser (migration / ZADA ID web
            // flow) counts as `inactive`, so a >60s web session followed by an "Add to wallet"
            // deeplink hit this exact path — the browser dismissal fires the `active` transition
            // concurrently with the deeplink navigation, and the replace stripped the redirect,
            // dumping the user on the home screen after PIN instead of the credential screen.
            secureUnlock.lock()
          }
          backgroundTimeRef.current = null
        }
      }
    }

    const subscription = AppState.addEventListener('change', handleAppStateChange)

    return () => {
      subscription.remove()
    }
  }, [secureUnlock])

  return <>{children}</>
}
