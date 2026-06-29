import fs from 'node:fs'
import path from 'node:path'
import { withDangerousMod } from '@expo/config-plugins'

// Expo config plugin: pull AndyQ/NFCPassportReader (MIT) into the iOS build for the passport-nfc
// native module. It's SPM/git-only (not in the CocoaPods trunk), so a podspec can't depend on it
// transitively — instead we inject the git pod into the CNG-generated Podfile during EAS prebuild.
// This runs automatically inside `eas build --platform ios`; there is NO manual Xcode step.
//
// Works here because base.app.config.js sets expo-build-properties ios.useFrameworks: 'dynamic',
// which is what a pure-Swift pod (and its OpenSSL-Universal dep) needs. The pod's own podspec at the
// pinned tag declares its OpenSSL-Universal dependency, which CocoaPods resolves automatically.
const NFC_POD_TAG = '2.3.1'
const POD_LINE = `  pod 'NFCPassportReader', :git => 'https://github.com/AndyQ/NFCPassportReader.git', :tag => '${NFC_POD_TAG}'`

const withNfcPassportReader = (config) =>
  withDangerousMod(config, [
    'ios',
    (cfg) => {
      const podfile = path.join(cfg.modRequest.platformProjectRoot, 'Podfile')
      let contents = fs.readFileSync(podfile, 'utf8')
      if (!contents.includes("pod 'NFCPassportReader'")) {
        // Insert just inside the first app target block: `target '...' do`.
        const targetRegex = /(target\s+['"][^'"]+['"]\s+do\s*\n)/
        contents = targetRegex.test(contents)
          ? contents.replace(targetRegex, `$1${POD_LINE}\n`)
          : contents.replace(/\nend\s*$/, `\n${POD_LINE}\nend\n`)
        fs.writeFileSync(podfile, contents)
      }
      return cfg
    },
  ])

export default withNfcPassportReader
