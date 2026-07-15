// React Native autolinking overrides.
//
// NOTE: written as ESM (`export default`) on purpose — apps/easypid/package.json has
// "type": "module", so a `.js` file here is parsed as an ES module. Using CommonJS
// `module.exports` throws "module is not defined in ES module scope" in React Native's codegen
// ("Generate Specs") step, and the RN config loader does NOT pick up a `.cjs` rename — so ESM in
// `react-native.config.js` is the one form that satisfies both.
//
// Exclude @react-native-ml-kit/text-recognition (MRZ OCR) from the iOS native build. Its podspec
// pulls the GoogleMLKit / MLKit* / GoogleUtilities* subtree in as STATIC binaries, which CocoaPods
// refuses to link into this project's dynamic `use_frameworks!` setup — the first iOS build failed at
// `pod install` with "transitive dependencies that include statically linked binaries". This costs
// nothing functional: ML Kit OCR is already non-functional on the New Architecture (see
// modules/passport-nfc/README.md); the OCR call is wrapped and degrades to manual MRZ entry
// (PassportScanScreen.tsx). Android keeps the native module.
export default {
  dependencies: {
    '@react-native-ml-kit/text-recognition': {
      platforms: {
        ios: null,
      },
    },
  },
}
