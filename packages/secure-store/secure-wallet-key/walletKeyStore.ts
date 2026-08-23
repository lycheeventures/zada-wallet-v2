import { Platform } from 'react-native'
import * as Keychain from 'react-native-keychain'
import { BiometricAuthenticationError } from '../../agent/src'
import {
  getKeychainItemById,
  type KeychainAuthenticationTypeOptions,
  type KeychainSetOptions,
  removeKeychainItemById,
  storeKeychainItem,
} from '../keychain'

const walletKeyStoreBaseOptions: KeychainSetOptions & KeychainAuthenticationTypeOptions = {
  /* Only allow the current set of enrolled biometrics to access the wallet key */
  accessControl: Keychain.ACCESS_CONTROL.BIOMETRY_CURRENT_SET,

  // TODO: might want to use WHEN_UNLOCKED_THIS_DEVICE_ONLY, to allow devices without a passcode (as we have our own passcode and extra biometrics check)
  // Not sure how it works if you have no passcode, but you do have biometrics (i think that is not possible?)
  /* Only allow access to the wallet key on the device is was created on, is unlocked, and has a passcode set */
  accessible: Keychain.ACCESSIBLE.WHEN_PASSCODE_SET_THIS_DEVICE_ONLY,

  // TODO: internationalization
  authenticationPrompt: {
    title: 'Unlock wallet',
    description: 'Access to your wallet is locked behind a biometric verification.',
  },

  /* Android Only. Ensure wallet key is protected by hardware. Wil results in error if hardware is not available. Hardware is either StrongBox or TEE */
  securityLevel: Keychain.SECURITY_LEVEL.SECURE_HARDWARE,

  /**
   * Android Only. AES-256-GCM with `setUserAuthenticationRequired`.
   *
   * This used to be `STORAGE_TYPE.RSA`, with the note "this is the only storage type supporting
   * biometrics". That was true of older react-native-keychain; since v10 `AES_GCM` is the
   * biometric-gated symmetric storage and RSA is only needed for asymmetric operations we don't do.
   *
   * RSA-2048/ECB/PKCS1 with a user-auth-bound key is the flakiest thing you can ask an OEM keystore
   * for, and we have a device (Aug 2026) where storing the key works but reading it back fails with
   * `CryptoFailedException: Wrapped error: unknown key type ...`. AES-GCM is the primitive every
   * Android keystore has to implement well.
   *
   * Safe for existing installs: reads resolve the cipher storage from the *stored* entry, not from
   * these options, and react-native-keychain v10 never auto-migrates between cipher storages
   * (`migrateCipherStorage` is dead code). Anyone with an RSA-stored key keeps using RSA until they
   * re-enable biometrics.
   */
  storage: Keychain.STORAGE_TYPE.AES_GCM,

  /* Ensure wallet key is protected by biometrics. It is not possible to fallback to the device passcode if the biometric authentication failed. */
  authenticationType: Keychain.AUTHENTICATION_TYPE.BIOMETRICS,
}

/**
 * Same options, minus the hardware-backed requirement.
 *
 * `securityLevel: SECURE_HARDWARE` makes react-native-keychain generate the key and then throw
 * "Cannot generate keys with required security guarantees" whenever the resulting key is not
 * reported as living inside secure hardware. `canUseBiometryBackedWalletKey` below already
 * accepts SECURE_SOFTWARE devices, so demanding SECURE_HARDWARE on write contradicts the gate:
 * the device is offered biometrics and then fails to store the key, taking onboarding with it.
 *
 * We still *try* hardware-backed storage first and only fall back to this, so nothing is
 * downgraded on devices that can do it. Reads are unaffected — the Android module resolves the
 * cipher storage from the stored entry and does not re-check the security level.
 */
const { securityLevel: _requireSecureHardware, ...walletKeyStoreSoftwareFallbackOptions } = walletKeyStoreBaseOptions

const WALLET_KEY_ID = (version: number) => `PARADYM_WALLET_KEY_${version}`

/**
 * Returns whether biometry backed wallet key can be used. Can be called before trying to access
 * or store the wallet key in the keychain.
 */
async function canUseBiometryBackedWalletKey(): Promise<boolean> {
  if (Platform.OS === 'android') {
    /**
     * `setUserAuthenticationParameters` is only available on Android API 30+, and is needed to ensure
     * the key can only be accessed using biometry. React Native Keychain will fallback to allowing keys
     * to be accessed by the device passcode. For this reason we only allow biometry to be used on devices
     * running Android API 30 or higher.
     */
    if (Platform.Version < 30) {
      return false
    }

    /**
     * Android Only API. Allow both hardware- and software-backed secure key storage for unlocking
     * with biometrics. Requiring SECURE_HARDWARE (StrongBox/TEE) only rejected every device whose
     * keystore reports SECURE_SOFTWARE, which broke enabling biometrics during onboarding (it errored
     * and fell back to PIN). Mirrors upstream paradym-wallet fix #535.
     */
    const securityLevel = await Keychain.getSecurityLevel(walletKeyStoreBaseOptions)
    if (
      !securityLevel ||
      (securityLevel !== Keychain.SECURITY_LEVEL.SECURE_SOFTWARE &&
        securityLevel !== Keychain.SECURITY_LEVEL.SECURE_HARDWARE)
    ) {
      return false
    }
  }

  if (Platform.OS === 'ios') {
    /**
     * Checks whether the key can be authenticated using only biometrics (no passcode fallback)
     */
    const canUseAuthentication = await Keychain.canImplyAuthentication(walletKeyStoreBaseOptions)
    if (!canUseAuthentication) return false
  }

  const supportedBiometryType = await Keychain.getSupportedBiometryType()

  /**
   * We only support biometrics secured storage of the wallet key
   */
  return supportedBiometryType !== null
}

/**
 * Store the wallet key in biometric protected storage, hardware backed where the device allows it.
 *
 * Uses Secure Enclave on iOS and StrongBox/TEE on Android. On Android, if the keystore refuses to
 * give us a hardware-backed key we retry once without that requirement rather than fail — see
 * `walletKeyStoreSoftwareFallbackOptions`.
 *
 * @throws {KeychainError} if an unexpected error occurs
 * @throws {BiometricAuthenticationError} if biometrics is cancelled or not enrolled
 */
async function storeWalletKey(walletKey: string, version: number): Promise<void> {
  const walletKeyId = WALLET_KEY_ID(version)

  try {
    await storeKeychainItem(walletKeyId, walletKey, walletKeyStoreBaseOptions)
  } catch (error) {
    /**
     * A biometric error is about the user or their enrolment, not about the storage guarantee.
     * Retrying without the hardware requirement would not help and would hide the real reason.
     */
    if (error instanceof BiometricAuthenticationError) throw error

    // securityLevel is an Android-only option, so there is nothing to relax on iOS.
    if (Platform.OS !== 'android') throw error

    await storeKeychainItem(walletKeyId, walletKey, walletKeyStoreSoftwareFallbackOptions)
  }
}

/**
 * Retrieve the wallet key from hardware backed, biometric protected storage.
 *
 * @returns {string | null} the wallet key or null if it doesn't exist
 * @throws {KeychainError} if an unexpected error occurs
 */
async function getWalletKeyUsingBiometrics(version: number): Promise<string | null> {
  const walletKeyId = WALLET_KEY_ID(version)
  return await getKeychainItemById(walletKeyId, walletKeyStoreBaseOptions)
}

/**
 * Delete the wallet key from hardware backed, biometric protected storage.
 *
 * @returns {boolean} whether the wallet key was removed (false if the wallet key wasn't stored)
 * @throws {KeychainError} if an unexpected error occurs
 */
async function removeWalletKey(version: number): Promise<boolean> {
  const walletKeyId = WALLET_KEY_ID(version)
  return await removeKeychainItemById(walletKeyId, walletKeyStoreBaseOptions)
}

export const walletKeyStore = {
  removeWalletKey,
  getWalletKeyUsingBiometrics,
  storeWalletKey,
  canUseBiometryBackedWalletKey,
}
