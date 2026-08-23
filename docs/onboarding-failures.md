# Onboarding failures: "Error occurred during onboarding"

Written after an Aug 2026 field report (OPPO Reno 15 Pro, ColorOS): the user could not get past
the "Choose a 6-digit PIN" step. The app shipped no crash reporting and the toast carried no
detail, so there was nothing to triage with. This note records how the failure paths work and
what changed.

## Reading the symptom

`"Error occurred during onboarding"` comes from exactly one place — `reset()` in
`src/features/onboarding/onboardingContext.tsx`. **Where the user lands tells you which step
failed:**

| Failing step | Caller | User lands on |
|---|---|---|
| PIN confirm (wallet creation) | `onPinReEnter` → `reset({ resetToStep: 'welcome' })` | **Welcome** screen |
| Biometrics enable | `onEnableBiometrics` → `reset({ resetToStep: 'pin' })` | **"Choose a 6-digit PIN"** screen |

A user who says "it fails when I choose the PIN" is most likely hitting the **biometrics**
failure — that path is what drops them back onto the PIN screen.

## The biometrics loop (fixed)

`onEnableBiometrics` used to call `reset()` for any error that wasn't a recognised
`BiometricAuthenticationCancelledError` / `NotEnabledError`. `reset()` calls `resetWallet()`, so a
device whose keystore simply cannot store a biometry-backed key **wiped the wallet the user had
just created and sent them back to the PIN step — forever**. The only escape was "Set up later".

Recognition of those two error classes is substring matching on native error text and Android
`BiometricPrompt` codes (`packages/agent/src/invitation/error.ts`), so any OEM message outside
that list falls through to the generic path. Assume the list is incomplete.

Now: an unrecognised error disables biometrics, clears any half-stored key, shows the real
reason, and **continues onboarding with PIN-only unlock**. Biometrics stays available in Settings.

## The SECURE_HARDWARE contradiction (fixed)

`packages/secure-store/secure-wallet-key/walletKeyStore.ts` had two rules that disagreed:

- `canUseBiometryBackedWalletKey()` was relaxed in Jul 2026 to accept devices reporting
  `SECURE_SOFTWARE` (no StrongBox).
- `storeWalletKey()` still passed `securityLevel: SECURE_HARDWARE`, which makes
  react-native-keychain generate the key and then throw *"Cannot generate keys with required
  security guarantees"* if the key isn't reported as living inside secure hardware.

So a device could pass the gate, be offered biometrics, and then fail the write. `storeWalletKey`
now retries once on Android without the hardware requirement. Hardware-backed is still attempted
first, and reads are unaffected (the Android module resolves the cipher storage from the stored
entry and does not re-check the level).

## Diagnostics

There is still **no crash reporting in this app**. As a stopgap:

- `src/features/onboarding/onboardingError.ts` keeps the last onboarding error (one line, follows
  the `cause` chain, MMKV-backed so it survives a restart, cleared when onboarding completes).
- It is shown in the error toast and attached to the support chat's device diagnostics as
  `lastOnboardingError`. **The wallet-support-proxy must pass that field through** for it to reach
  the internal note — see `docs/wallet-support-chat.md` in the openclaw-do repo.

Real crash reporting (Sentry) is still the right fix and is not done.
