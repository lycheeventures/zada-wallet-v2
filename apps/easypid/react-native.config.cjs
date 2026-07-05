// React Native autolinking overrides.
//
// Exclude @react-native-ml-kit/text-recognition (MRZ OCR) from the iOS native build. Its podspec
// pulls the GoogleMLKit / MLKit* / GoogleUtilities* subtree in as STATIC binaries, which CocoaPods
// refuses to link into this project's dynamic `use_frameworks!` setup — the first iOS build failed at
// `pod install` with "transitive dependencies that include statically linked binaries: (GoogleMLKit,
// MLKitCommon, … GoogleUtilitiesComponents, …)". Marking that subtree static_framework only shifts the
// same check onto every pod in it, so the clean fix is to not link it on iOS at all.
//
// This costs nothing functional: ML Kit OCR is already non-functional on the New Architecture (see
// modules/passport-nfc/README.md), and the passport flow's OCR call is wrapped so it degrades to the
// working manual-MRZ-entry path (PassportScanScreen.tsx). Android keeps the native module.
module.exports = {
  dependencies: {
    '@react-native-ml-kit/text-recognition': {
      platforms: {
        ios: null,
      },
    },
  },
}
