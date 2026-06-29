import { createBaseConfig } from './base.app.config'
import { version } from './package.json'
import withNfcPassportReader from './plugins/withNfcPassportReader.js'

const mediatorDids = {
  development: 'did:web:mediator.dev.paradym.id',
  preview: 'did:web:mediator.paradym.id',
  production: 'did:web:mediator.paradym.id',
}

const APP_CONFIGS = {
  FUNKE_WALLET: createBaseConfig({
    name: 'Funke Wallet',
    scheme: 'id.animo.ausweis',
    icon: './assets/funke/icon.png',
    // NOTE: android requires paths referenced directly in code
    // to only contain _ a-Z 0-9, so we use _ for all files
    adaptiveIcon: './assets/funke/adaptive_icon.png',
    splash: './assets/funke/splash.png',
    splashIcon: './assets/funke/splash_icon.png',
    slug: 'ausweis-wallet',
    version,
    bundleId: 'id.animo.ausweis',
    associatedDomains: ['funke.animo.id'],
    projectId: '28b058bb-3c4b-4347-8e72-41dfc1dd99eb',
    assets: ['./assets/funke/icon.png'],
  }),

  PARADYM_WALLET: createBaseConfig({
    name: 'ZADA',
    scheme: 'id.animo.paradym',
    icon: './assets/paradym/icon.png',
    adaptiveIcon: './assets/paradym/adaptive_icon.png',
    splash: './assets/paradym/splash.png',
    splashIcon: './assets/paradym/splash_icon.png',
    slug: 'zada-edge-wallet',
    version,
    bundleId: 'com.zadanetwork.wallet',
    additionalInvitationSchemes: ['didcomm'],
    associatedDomains: ['paradym.id', 'dev.paradym.id', 'paradymwallet.app'],
    projectId: '898f5f59-f246-4fa4-b73d-0140443f967b',
    assets: ['./assets/paradym/icon.png'],
    extraConfig: {
      mediatorDid: mediatorDids[process.env.APP_VARIANT || 'production'],
      allowedRedirectBaseUrls: ['https://paradymwallet.app/oauth2/redirect', 'https://paradym.id/invitation/redirect'],
    },
  }),
}

// Add Funke specific configurations
APP_CONFIGS.FUNKE_WALLET.ios.entitlements = {
  'com.apple.developer.kernel.increased-memory-limit': true,
}
APP_CONFIGS.FUNKE_WALLET.android.config = {
  largeHeap: true,
}

// ZADA: NFC tag reading entitlement for the passport-nfc module (iOS CoreNFC). Requires the
// "Near Field Communication Tag Reading" capability enabled on the App ID in the Apple Developer
// portal, otherwise the build's provisioning profile won't carry it. The eMRTD AID we select and the
// usage string live in base.app.config.js infoPlist.
APP_CONFIGS.PARADYM_WALLET.ios.entitlements = {
  'com.apple.developer.nfc.readersession.formats': ['TAG'],
}
// Pull NFCPassportReader into the iOS build (it's git/SPM-only, so it can't be a podspec dep).
APP_CONFIGS.PARADYM_WALLET.plugins = [...APP_CONFIGS.PARADYM_WALLET.plugins, withNfcPassportReader]

export default () => {
  const appType = process.env.EXPO_PUBLIC_APP_TYPE ?? 'PARADYM_WALLET'
  if (!appType || !APP_CONFIGS[appType]) {
    throw new Error(`Invalid App Type: ${appType}. Must be one of: ${Object.keys(APP_CONFIGS).join(', ')}`)
  }

  console.log(`Using app config for app ${appType}`)
  return APP_CONFIGS[appType]
}
