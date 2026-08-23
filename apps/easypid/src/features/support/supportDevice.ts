/**
 * Best-effort device diagnostics, sent once when a NEW conversation starts and
 * attached (server-side) as a hidden internal note — the customer never sees it,
 * but the support team + Eir get OS / app version context for triage.
 */
import { getLastOnboardingError } from '@easypid/features/onboarding/onboardingError'
import * as Application from 'expo-application'
import * as Device from 'expo-device'
import { Platform } from 'react-native'

export type DeviceDiagnostics = {
  os: string
  osVersion?: string
  model?: string
  brand?: string
  appVersion?: string
  build?: string
  locale?: string
  /**
   * Last onboarding failure, if the user got through onboarding on a second attempt or is still
   * stuck. Cleared once onboarding completes. Needs the wallet-support-proxy to pass it through
   * to the internal note (see docs/wallet-support-chat.md in the openclaw-do repo).
   */
  lastOnboardingError?: string
}

export function getDeviceDiagnostics(): DeviceDiagnostics {
  return {
    os: Platform.OS,
    osVersion: Device.osVersion ?? undefined,
    model: Device.modelName ?? undefined,
    brand: Device.brand ?? undefined,
    appVersion: Application.nativeApplicationVersion ?? undefined,
    build: Application.nativeBuildVersion ?? undefined,
    locale: resolveLocale(),
    lastOnboardingError: getLastOnboardingError(),
  }
}

function resolveLocale(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().locale
  } catch {
    return undefined
  }
}
