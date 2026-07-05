require 'json'

package = JSON.parse(File.read(File.join(__dir__, '..', 'package.json')))

Pod::Spec.new do |s|
  s.name           = 'PassportNfc'
  s.version        = package['version']
  s.summary        = 'ZADA eMRTD/passport NFC reader (iOS, CoreNFC + NFCPassportReader)'
  s.description    = 'App-local Expo native module: reads an ICAO 9303 passport chip over CoreNFC.'
  s.author         = 'ZADA'
  s.homepage       = 'https://zada.io'
  s.license        = { :type => 'MIT' }
  s.platforms      = { :ios => '15.0' }
  s.swift_version  = '5.9'
  s.source         = { :git => '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  # NFCPassportReader (MIT) is NOT in the CocoaPods trunk. Its SOURCE is declared in the CNG Podfile as
  # a git pod by plugins/withNfcPassportReader.js (`pod 'NFCPassportReader', :git => ..., :tag => ...`).
  # We STILL need this s.dependency: it wires that pod's module into THIS pod's target so
  # `import NFCPassportReader` in PassportNfcModule.swift resolves. (A Podfile-declared :git pod is a
  # valid target for a bare `s.dependency` by name — you just can't put the :git source here.) Without
  # it the app target links NFCPassportReader but the PassportNfc Swift target can't see the module.
  s.dependency 'NFCPassportReader'

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
