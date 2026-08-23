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

/** What we show the user in a toast — long enough to be useful, short enough to read. */
const TOAST_DESCRIPTION_LENGTH = 200

/**
 * What we keep for support. The first field report (Aug 2026) was cut off mid-message at
 * `unknown key type p...`, which was the one part that mattered — don't do that again.
 */
const RECORDED_DESCRIPTION_LENGTH = 600

export type OnboardingErrorStep = 'pin' | 'biometrics'

/**
 * One-line description of an error, following the `cause` chain.
 *
 * The interesting part is almost never the outer message: `KeychainError` and Credo both wrap
 * the real reason (the OEM keystore / askar message) in `cause`, so an outer-message-only
 * description tells us nothing.
 */
export function describeError(error: unknown, maxLength: number = TOAST_DESCRIPTION_LENGTH): string {
  const parts: string[] = []

  let current: unknown = error
  // Bounded, so a self-referencing cause chain can't hang us
  for (let depth = 0; depth < 4 && current instanceof Error; depth++) {
    parts.push(current.name === 'Error' ? current.message : `${current.name}: ${current.message}`)
    current = current.cause
  }

  const description = parts.length > 0 ? parts.join(' <- ') : String(error)
  return description.length > maxLength ? `${description.slice(0, maxLength - 1)}…` : description
}

export function recordOnboardingError(step: OnboardingErrorStep, error: unknown) {
  mmkv.set(LAST_ONBOARDING_ERROR_KEY, `${step}: ${describeError(error, RECORDED_DESCRIPTION_LENGTH)}`)
}

export function getLastOnboardingError(): string | undefined {
  return mmkv.getString(LAST_ONBOARDING_ERROR_KEY)
}

export function clearLastOnboardingError() {
  mmkv.remove(LAST_ONBOARDING_ERROR_KEY)
}
