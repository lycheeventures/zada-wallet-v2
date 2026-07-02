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

  # NFCPassportReader (MIT) is NOT in the CocoaPods trunk — it is SPM-recommended. It is therefore
  # wired at the APP level, not as an s.dependency here (a git pod can't be a transitive podspec dep).
  # See ../README.md → "iOS dependency wiring". Until that is in place, the iOS build will fail to
  # resolve `import NFCPassportReader`.

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
