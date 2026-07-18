const APP_VARIANT = process.env.APP_VARIANT || 'production'

const variants = {
  development: {
    bundle: '.dev',
    name: ' (Dev)',
  },
  preview: {
    bundle: '.preview',
    name: ' (Preview)',
  },
  production: {
    bundle: '',
    name: '',
  },
}

const variant = variants[APP_VARIANT]

if (!variant) {
  throw new Error(`Invalid variant provided: ${process.env.APP_VARIANT}`)
}

// NOTE: Keep this in sync with the `QrTypes` enum
const baseInvitationSchemes = [
  'openid',
  'openid-initiate-issuance',
  'openid-credential-offer',
  'openid-vc',
  'openid4vp',
  'eudi-openid4vp',
  'mdoc-openid4vp',
  'haip',
]

const baseAssets = [
  './assets/german_issuer_image.png',
  './assets/pid_background.jpg',
  './assets/mdl/code_l.png',
  './assets/mdl/code_t.png',
  './assets/mdl/code_d1e.png',
  './assets/mdl/code_de.png',
  './assets/mdl/code_be.png',
  './assets/mdl/code_c1e.png',
  './assets/mdl/code_ce.png',
  './assets/mdl/code_a2.png',
  './assets/mdl/code_am.png',
  './assets/mdl/code_a1.png',
  './assets/mdl/code_d.png',
  './assets/mdl/code_d1.png',
  './assets/mdl/code_b.png',
  './assets/mdl/code_c.png',
  './assets/mdl/code_c1.png',
  './assets/mdl/code_a.png',
]
/**
 * Creates a base configuration that can be extended by specific apps
 * @param {Object} appSpecific - App specific configuration
 * @returns {import('@expo/config-types').ExpoConfig}
 */
const createBaseConfig = (appSpecific) => {
  const {
    name,
    scheme,
    slug,
    adaptiveIcon,
    icon,
    splash,
    splashIcon,
    additionalInvitationSchemes = [],
    associatedDomains = [],
    projectId,
    extraConfig = {},
  } = appSpecific

  const invitationSchemes = [...baseInvitationSchemes, ...additionalInvitationSchemes, scheme]

  return {
    name: `${name}${variant.name}`,
    scheme,
    slug,
    owner: 'zada-solutions',
    version: appSpecific.version,
    orientation: 'portrait',
    icon,
    userInterfaceStyle: 'light',
    backgroundColor: '#1B3760',
    updates: {
      fallbackToCacheTimeout: 0,
    },
    plugins: [
      'expo-web-browser',
      'expo-localization',
      [
        'react-native-edge-to-edge',
        {
          android: {
            enforceNavigationBarContrast: false,
          },
        },
      ],
      [
        'expo-splash-screen',
        {
          backgroundColor: '#1B3760',
          image: splashIcon,
          resizeMode: 'contain',
          imageWidth: 200,
          android: {
            backgroundColor: '#1B3760',
            image: splashIcon,
          },
          ios: {
            image: splash,
            resizeMode: 'cover',
            enableFullScreenImage_legacy: true,
            backgroundColor: '#1B3760',
          },
        },
      ],
      'expo-secure-store',
      'expo-router',
      [
        'expo-camera',
        {
          cameraPermission:
            '$(PRODUCT_NAME) uses the camera to scan invitation QR-codes, allowing you to receive or share cards from your wallet.',
        },
      ],
      [
        'expo-asset',
        {
          assets: [...baseAssets, ...appSpecific.assets],
        },
      ],
      [
        '@animo-id/expo-mdoc-data-transfer',
        {
          ios: {
            buildStatic: ['RNReanimated', 'RNScreens', 'askar', 'anoncreds'],
          },
        },
      ],
      [
        'expo-build-properties',
        {
          android: {
            minSdkVersion: 26,
            compileSdkVersion: 36,
            useLegacyPackaging: true,
            extraMavenRepos: ['https://s01.oss.sonatype.org/content/repositories/snapshots/'],
            // arm64-v8a covers every modern phone; armeabi-v7a keeps 32-bit devices — still common
            // in the Myanmar/Thailand user base — able to install. Play splits the AAB per device,
            // so the second ABI costs build time, not download size. x86/x86_64 are omitted
            // (emulators only); all four OOM-kill the Gradle daemon below the `large` resource class.
            buildArchs: ['arm64-v8a', 'armeabi-v7a'],
          },
          ios: {
            deploymentTarget: '16.0',
            useFrameworks: 'dynamic',
          },
        },
      ],
      [
        'expo-dev-client',
        {
          launchMode: 'most-recent',
        },
      ],
      [
        'expo-font',
        {
          fonts: [
            '../../node_modules/@expo-google-fonts/open-sans/400Regular/OpenSans_400Regular.ttf',
            '../../node_modules/@expo-google-fonts/open-sans/500Medium/OpenSans_500Medium.ttf',
            '../../node_modules/@expo-google-fonts/open-sans/600SemiBold/OpenSans_600SemiBold.ttf',
            '../../node_modules/@expo-google-fonts/open-sans/700Bold/OpenSans_700Bold.ttf',
            '../../node_modules/@expo-google-fonts/raleway/400Regular/Raleway_400Regular.ttf',
            '../../node_modules/@expo-google-fonts/raleway/500Medium/Raleway_500Medium.ttf',
            '../../node_modules/@expo-google-fonts/raleway/600SemiBold/Raleway_600SemiBold.ttf',
            '../../node_modules/@expo-google-fonts/raleway/700Bold/Raleway_700Bold.ttf',
          ],
        },
      ],
    ],
    assetBundlePatterns: ['**/*'],
    ios: {
      supportsTablet: false,
      bundleIdentifier: `${appSpecific.bundleId}${variant.bundle}`,
      infoPlist: {
        NSCameraUsageDescription: `${name} uses the camera to initiate receiving and sharing of credentials.`,
        NSFaceIDUsageDescription: `${name} uses FaceID to securely unlock the wallet and share credentials.`,
        NSPhotoLibraryUsageDescription: `${name} requires photo library access for credential sharing functionality.`,
        NFCReaderUsageDescription: `${name} reads the NFC chip in your passport to verify and import it.`,
        // iOS requires pre-declaring the ISO7816 application identifiers we will SELECT. The eMRTD
        // (passport) application AID is A0000002471001. Consumed by the passport-nfc iOS module.
        'com.apple.developer.nfc.readersession.iso7816.select-identifiers': ['A0000002471001'],
        ITSAppUsesNonExemptEncryption: false,
        CFBundleURLTypes: [
          {
            CFBundleURLSchemes: invitationSchemes,
          },
        ],
      },
      associatedDomains: associatedDomains.map((host) => `applinks:${host}`),
    },
    android: {
      edgeToEdgeEnabled: true,
      allowBackup: false,
      adaptiveIcon: {
        foregroundImage: adaptiveIcon,
      },
      package: `${appSpecific.bundleId}${variant.bundle}`,
      intentFilters: [
        ...invitationSchemes.map((scheme) => ({
          action: 'VIEW',
          category: ['DEFAULT', 'BROWSABLE'],
          data: {
            scheme,
          },
        })),
        ...associatedDomains.flatMap((host) =>
          ['/invitation', '/wallet/redirect', '/oauth2/redirect'].map((path) => ({
            action: 'VIEW',
            category: ['DEFAULT', 'BROWSABLE'],
            autoVerify: true,
            data: {
              scheme: 'https',
              host,
              pathPrefix: path,
            },
          }))
        ),
      ],
    },
    extra: {
      eas: {
        projectId,
      },
      // credential-key-usher web flow for migrating legacy ZADA credentials (per-build via env).
      credentialMigrationUrl: process.env.CREDENTIAL_MIGRATION_URL ?? 'https://migrate.zada.solutions',
      ...extraConfig,
    },
  }
}

export { createBaseConfig, variant }
