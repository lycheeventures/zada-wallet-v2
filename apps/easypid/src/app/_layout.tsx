import 'fast-text-encoding'

import { isGetCredentialActivity } from '@animo-id/expo-digital-credentials-api'
import { BackgroundLockProvider, NoInternetToastProvider, Provider } from '@package/app'
import { SecureUnlockProvider } from '@package/secure-store/secureUnlock'
import { DefaultTheme, ThemeProvider } from '@react-navigation/native'
import { Slot } from 'expo-router'
import * as SplashScreen from 'expo-splash-screen'
import { Platform } from 'react-native'
import { SystemBars } from 'react-native-edge-to-edge'
import tamaguiConfig from '../../tamagui.config'
import { useStoredLocale } from '../hooks/useStoredLocale'
import { refreshZadaRegistryInBackground } from '../services/zadaRegistry'

void SplashScreen.preventAutoHideAsync()

// Warm the ZADA trust registry at launch so a verify/receive flow never has to wait on the network
// to decide whether it recognises the other party. Fire-and-forget: it fails silently where the
// registry is unreachable, and the cached/bundled copy carries the flow.
refreshZadaRegistryInBackground()

export const unstable_settings = {
  // Ensure any route can link back to `/`
  initialRouteName: '/(app)/index',
}

export default function RootLayoutWithoutDcApi() {
  // With Expo Router the main application is always rendered, which is different from plain react native
  // To prevent this, we render null at the root
  if (Platform.OS === 'android' && isGetCredentialActivity()) {
    console.log('not rendering main application due to DC API')
    return null
  }

  return <RootLayout />
}

function RootLayout() {
  const [storedLocale] = useStoredLocale()

  return (
    <Provider config={tamaguiConfig} customLocale={storedLocale}>
      <SystemBars style="dark" />
      <SecureUnlockProvider>
        <ThemeProvider
          value={{
            ...DefaultTheme,
            colors: {
              ...DefaultTheme.colors,
              background: 'white',
            },
          }}
        >
          <BackgroundLockProvider>
            <NoInternetToastProvider>
              <Slot />
            </NoInternetToastProvider>
          </BackgroundLockProvider>
        </ThemeProvider>
      </SecureUnlockProvider>
    </Provider>
  )
}
