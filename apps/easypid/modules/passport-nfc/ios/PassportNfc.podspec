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

  # NFCPassportReader is injected into the CNG Podfile as a git pod at the APP target by
  # plugins/withNfcPassportReader.js and builds as NFCPassportReader.framework.
  #
  # Do NOT add `s.dependency 'NFCPassportReader'` here. Empirically (build #5 had a clean Pods project;
  # build #6 — which only added that line — did not), that one dependency edge made CocoaPods
  # re-serialize Pods.xcodeproj and rewrite the eudi mdoc SPM references (XCRemoteSwiftPackageReference)
  # into a form xcodebuild rejects at archive time:
  #   -[XCRemoteSwiftPackageReference _setSavedArchiveVersion:]: unrecognized selector
  #   → "The project 'Pods' is damaged" → `import Expo` "no such module 'Expo'".
  # Without the edge the project serializes cleanly and everything compiles.
  #
  # All we actually need is for `import NFCPassportReader` to resolve in THIS target's Swift compile, so
  # point the target at the framework's build dir — no dependency edge, pod graph unchanged:
  s.pod_target_xcconfig = {
    'FRAMEWORK_SEARCH_PATHS' => '$(inherited) "${PODS_CONFIGURATION_BUILD_DIR}/NFCPassportReader"',
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
