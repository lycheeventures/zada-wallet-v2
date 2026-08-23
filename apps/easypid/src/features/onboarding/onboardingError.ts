/**
 * Onboarding failures used to vanish into a `console.error` plus a generic
 * "Error occurred during onboarding" toast. When a user hit one on a device we don't own
 * (an OPPO Reno 15 Pro, Aug 2026) there was nothing left to triage with — the app ships no
 * crash reporting.
 *
 * So we keep the last onboarding error: short, non-sensitive, and MMKV-backed so it survives
 * the app restart that usually follows a failed onboarding. It is shown to the user in the
 * error toast and attached to the support chat's device diagnostics.
 */
import { mmkv } from '../../storage/mmkv'

const LAST_ONBOARDING_ERROR_KEY = 'lastOnboardingError'

/** This ends up in a toast and a support note, not a log file — keep it to one line. */
const MAX_DESCRIPTION_LENGTH = 160

export type OnboardingErrorStep = 'pin' | 'biometrics'

/**
 * One-line description of an error, following the `cause` chain.
 *
 * The interesting part is almost never the outer message: `KeychainError` and Credo both wrap
 * the real reason (the OEM keystore / askar message) in `cause`, so an outer-message-only
 * description tells us nothing.
 */
export function describeError(error: unknown): string {
  const parts: string[] = []

  let current: unknown = error
  // Bounded, so a self-referencing cause chain can't hang us
  for (let depth = 0; depth < 4 && current instanceof Error; depth++) {
    parts.push(current.name === 'Error' ? current.message : `${current.name}: ${current.message}`)
    current = current.cause
  }

  const description = parts.length > 0 ? parts.join(' <- ') : String(error)
  return description.length > MAX_DESCRIPTION_LENGTH
    ? `${description.slice(0, MAX_DESCRIPTION_LENGTH - 1)}…`
    : description
}

export function recordOnboardingError(step: OnboardingErrorStep, error: unknown) {
  mmkv.set(LAST_ONBOARDING_ERROR_KEY, `${step}: ${describeError(error)}`)
}

export function getLastOnboardingError(): string | undefined {
  return mmkv.getString(LAST_ONBOARDING_ERROR_KEY)
}

export function clearLastOnboardingError() {
  mmkv.remove(LAST_ONBOARDING_ERROR_KEY)
}
