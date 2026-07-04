import fs from 'node:fs'
import path from 'node:path'
// @expo/config-plugins is CommonJS; under this ESM package, named imports aren't exposed, so
// default-import the module object and destructure (same pattern as withNfcPassportReader.js).
import configPlugins from '@expo/config-plugins'

const { withDangerousMod } = configPlugins

// Expo config plugin: fix the first-iOS-build `pod install` failure
//   [!] The 'Pods-ZADA' target has transitive dependencies that include statically linked
//       binaries: (GoogleUtilitiesComponents)
//
// Cause: the project uses `use_frameworks! :linkage => :dynamic` (base.app.config.js —
// expo-build-properties ios.useFrameworks: 'dynamic', required by pure-Swift pods like Skia and
// NFCPassportReader). ML Kit (`@react-native-ml-kit/text-recognition`, our MRZ OCR) pulls in the
// GoogleUtilities / GoogleMLKit subtree as STATIC binaries, which CocoaPods refuses to link into a
// dynamic-framework target. Marking that subtree `static_framework` is the canonical resolution.
// (ML Kit OCR is currently New-Arch-broken anyway — manual MRZ entry is the working path — so this
// only keeps the build linking; behaviour is unchanged.)
//
// Why this is intertwined with @animo-id/expo-mdoc-data-transfer:
// A Podfile may only have ONE `pre_install` hook — a later definition silently REPLACES an earlier
// one. That package's plugin also appends a `pre_install` (forcing RNReanimated/RNScreens/askar/
// anoncreds to `static_library`). To avoid the two clobbering each other, we emit a SINGLE combined
// pre_install that does BOTH jobs. Because it contains the literal `Pod::BuildType.static_library`,
// the mdoc plugin's idempotency guard (`if contents.includes('Pod::BuildType.static_library')`) then
// skips appending its own block — and its array-rewrite (`mdoc_data_transfer_static_libraries=...`)
// fills in our placeholder with the real list. Robust to either plugin running first (see below).
const MARKER = '# ZADA: single combined pre_install (ML Kit static_framework + mdoc static_library)'

const preInstallBlock = (needsArrayPlaceholder) => `
${MARKER}
${needsArrayPlaceholder ? 'mdoc_data_transfer_static_libraries=[]\n' : ''}pre_install do |installer|
  zada_static_frameworks = [
    'GoogleUtilities', 'GoogleUtilitiesComponents', 'GoogleDataTransport', 'GoogleToolboxForMac',
    'GTMSessionFetcher', 'PromisesObjC', 'nanopb', 'MLImage', 'MLKitCommon', 'MLKitVision', 'GoogleMLKit',
  ]
  installer.pod_targets.each do |pod|
    if defined?(mdoc_data_transfer_static_libraries) && mdoc_data_transfer_static_libraries.include?(pod.name)
      def pod.build_type
        Pod::BuildType.static_library
      end
    elsif zada_static_frameworks.include?(pod.name) || pod.name.start_with?('MLKit')
      def pod.build_type
        Pod::BuildType.static_framework
      end
    end
  end
end
`

const withMlkitStaticFrameworks = (config) =>
  withDangerousMod(config, [
    'ios',
    (cfg) => {
      const podfile = path.join(cfg.modRequest.platformProjectRoot, 'Podfile')
      let contents = fs.readFileSync(podfile, 'utf8')
      if (!contents.includes(MARKER)) {
        // Only emit the array placeholder when the mdoc plugin hasn't already defined the real list
        // (i.e. we ran first). If it ran first, its real array line already exists — re-declaring it
        // as [] here would clobber it, so we skip the placeholder and just reference the existing one.
        const needsArrayPlaceholder = !contents.includes('mdoc_data_transfer_static_libraries')
        // Append at Podfile ROOT scope (end of file), where pre_install belongs. Being last means we
        // win if the mdoc block already exists; if it comes after us, its guard skips it (see above).
        contents = `${contents.replace(/\s*$/, '')}\n${preInstallBlock(needsArrayPlaceholder)}`
        fs.writeFileSync(podfile, contents)
      }
      return cfg
    },
  ])

export default withMlkitStaticFrameworks
