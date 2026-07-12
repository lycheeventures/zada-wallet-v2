# `passport-nfc` — app-local Expo native module (Android)

Reads an ICAO 9303 eMRTD (passport) chip over NFC using **jMRTD**: PACE (fallback BAC) with the
MRZ-derived key → DG1 (MRZ) + DG2 (portrait) → MVP passive authentication (DG-hash integrity vs the
signed EF.SOD). Consumed by `apps/easypid/src/features/passport/*`.

- **Native deps** (`android/build.gradle`): `org.jmrtd:jmrtd:0.7.42`, `net.sf.scuba:scuba-sc-android:0.0.23`,
  `com.madgag.spongycastle:prov:1.58.0.0` (the crypto provider jMRTD expects). All on Maven Central.
- **JS API** (`index.ts`): `isNfcAvailable()`, `isPassportReaderAvailable()`, `readPassport({documentNumber,dateOfBirth,dateOfExpiry})`, `addPassportStatusListener()`, `cancelPassportRead()`.
- **Android only.** `expo-module.config.json` declares `platforms: ["android"]` and the FQCN
  `io.zada.passportnfc.PassportNfcModule`.

## ⚠️ Getting EAS to actually compile an app-local module (the hard-won part)

This module is **app-local** (lives in `apps/easypid/modules/`, not `node_modules`, not a workspace
package). Getting EAS Build to autolink it in this **pnpm monorepo** took several wasted builds.
Two conditions must BOTH hold — if either is missing the module is **silently skipped** (absent from
the gradle "Using expo modules" list, class missing from the APK, **no error**):

1. **The module dir must contain BOTH `package.json` AND `expo-module.config.json`.**
   Autolinking discovers app-local modules by scanning `modules/*` for a dir that has *both* files.
   Deleting `package.json` (thinking a local module doesn't need one) makes it vanish. The local
   `expo-modules-autolinking resolve` CLI is more lenient than EAS's gradle path and will report a
   false positive — **do not trust local resolve alone.**

2. **The native sources must actually reach the EAS builder.** EAS uploads a **shallow git clone of
   tracked files only** (`git ls-files <dir>` is the ground truth for what the builder receives). A
   broad `.gitignore` rule like a bare `android` (intended for the prebuild output) will sweep up this
   module's `android/` sources. **Do not rely on a parent-ignore + child-negation** (`android` +
   `!.../passport-nfc/android/**`) — EAS's ignore handling does not honor that combination the way git
   does. Instead **anchor** the prebuild ignore to the app dir: `/apps/easypid/android`,
   `/apps/easypid/ios`. (See the repo `.gitignore`.)

`apps/easypid/package.json` also sets `expo.autolinking.nativeModulesDir: "./modules"` — note this is
the **default**, so it's a no-op / documentation only; it was NOT the fix.

### Verify the module is in the APK (don't guess — grep the dex)

The single most useful debugging move. Download the EAS artifact and grep the compiled classes:

```bash
curl -sL -o app.apk "<Application Archive URL from `eas build:view <id>`>"
unzip -p app.apk 'classes*.dex' | strings | grep -c "passportnfc"   # >0 = linked
unzip -p app.apk 'classes*.dex' | strings | grep -ciE "org/jmrtd"   # jMRTD compiled in
# control: a known-present module, e.g. animo/mdoc, to prove the grep works
```

For a definitive check of what reached the builder, add a temporary
`eas-build-pre-install` step that runs `ls -laR modules/passport-nfc` and read it in the EAS
**"Install dependencies"** log.

## iOS (CoreNFC + NFCPassportReader) — scaffolded Jun 2026, not yet built/tested

iOS reads the chip via **CoreNFC** using [`NFCPassportReader`](https://github.com/AndyQ/NFCPassportReader)
(**MIT**). The Swift module `ios/PassportNfcModule.swift` mirrors the Android JS contract exactly —
same `PassportNfc` native name, `onStatus` events, and result dict — so `index.ts` and the feature UI
are unchanged across platforms. **iOS bonus:** `UIImage` decodes JPEG2000, so the DG2 portrait is
transcoded to JPEG and renders fine (sidesteps the Android JP2 gap).

**Apple prerequisites (one-time):**
- Paid Apple Developer membership (ZADA already has one, from the existing app).
- Enable the **"Near Field Communication Tag Reading"** capability on the App ID
  (`com.zadanetwork.wallet`) in the Apple Developer portal — otherwise EAS's provisioning profile
  won't carry the entitlement and the session fails at runtime.

**Config (already committed):**
- `app.config.js` → `PARADYM_WALLET.ios.entitlements['com.apple.developer.nfc.readersession.formats'] = ['TAG']`.
- `base.app.config.js` infoPlist → `NFCReaderUsageDescription` + `com.apple.developer.nfc.readersession.iso7816.select-identifiers: ['A0000002471001']` (eMRTD AID).
- `expo-module.config.json` → `platforms: ["android","ios"]`, `ios.modules: ["PassportNfcModule"]`.

**iOS dependency wiring — two pieces, and one trap (hard-won across builds #5–#9):**
NFCPassportReader is git/SPM-only (not in the CocoaPods trunk). Wiring it to the app-local `PassportNfc`
Expo module (which is its **own** pod target) takes two pieces:

1. **Source** — `apps/easypid/plugins/withNfcPassportReader.js` (registered in `app.config.js` for
   `PARADYM_WALLET`) injects the git pod into the CNG Podfile during EAS prebuild
   (`pod 'NFCPassportReader', :git => ..., :tag => '2.3.1'`). It builds as `NFCPassportReader.framework`
   and links into the **app** target. Works cleanly because `expo-build-properties` sets
   `ios.useFrameworks: 'dynamic'`.
2. **Visibility to the PassportNfc target** — so `import NFCPassportReader` in `PassportNfcModule.swift`
   resolves, `ios/PassportNfc.podspec` adds a **build setting only**:
   `s.pod_target_xcconfig = { 'FRAMEWORK_SEARCH_PATHS' => '$(inherited) "${PODS_CONFIGURATION_BUILD_DIR}/NFCPassportReader"' }`.

> ⚠️ **Do NOT use `s.dependency 'NFCPassportReader'` for piece 2.** It *seems* right (standard CocoaPods
> way to expose a pod to a target), and it does fix the import — but adding that dependency **edge** made
> CocoaPods re-serialize `Pods.xcodeproj` and rewrite the unrelated eudi mdoc **SPM** references
> (`XCRemoteSwiftPackageReference`) into a form `xcodebuild` rejects at archive time:
> `-[XCRemoteSwiftPackageReference _setSavedArchiveVersion:]: unrecognized selector` → *"The project
> 'Pods' is damaged"* → `import Expo` "no such module 'Expo'". It is **not** an Xcode-version bug
> (reproduced on both Xcode 26.0 and 16.4; the build before the edge was clean on Xcode 26). The
> `FRAMEWORK_SEARCH_PATHS` approach exposes the module without changing the pod graph, so the SPM refs
> serialize untouched. Symptom to watch for: build time *dropping* (e.g. 6m→3m) while "getting further"
> means you're failing **earlier**, not later.

Pinned to tag **2.3.1** (MIT, iOS 15).

**API names — validated against the 2.3.1 source (2026-07-05).** Checked every symbol the Swift module
uses against the resolved package; fixed four that would have broken the first build:
- `PassportUtils.getMRZKey(...)` → **inlined** `getMRZKey`/`pad`/`calcCheckSum` (the library ships them
  only in its *example app*, `Examples/*/Model/PassportUtils.swift`, not in the importable module).
- `NFCPassportModel.dateOfExpiry` → **`documentExpiryDate`** (the former doesn't exist).
- `NFCPassportModel.passiveAuthenticationPassed` → **`passportDataNotTampered`** (former doesn't exist;
  `passportCorrectlySigned` is the complementary SOD-signature flag to AND in for production).
- Confirmed OK as-is: `PassportReader()`, `readPassport(mrzKey:tags:customDisplayMessage:)`,
  `DataGroupId.{COM,DG1,DG2,SOD}`, `NFCViewDisplayMessage` cases, `NFCPassportReaderError.ResponseError`.

Still to **validate on the first iOS build** (needs the Apple toolchain, couldn't be compiled here):
- **OpenSSL-Universal coexistence:** NFCPassportReader's podspec depends on `OpenSSL-Universal`. Confirm
  it doesn't clash with any OpenSSL pulled by Credo/Askar/other pods. If it does, pin/exclude in the
  plugin.

**Build & test:** NFC does **not** work in the iOS Simulator — needs a real device (iPhone 7+, iOS 15+)
on a device/internal-distribution profile (not `paradym-preview-simulator`).

**Replacing the live iOS app:** to ship as an *update* (not a new listing), the production bundle id
must equal the existing app's (currently `com.zadanetwork.wallet`), same team, higher build/version.
Existing users re-claim their old cloud-wallet credentials via the migration flow
(`MigrationWelcomeSheet`).

## Known limitations / TODO

- **DG2 portrait is JPEG2000.** It's captured and carried in the credential as
  `data:image/jp2;base64,…`, but RN/`expo-image` can't render JP2, so it shows blank. Rendering needs
  a native JP2→JPEG transcode; the only Android JP2 decoder readily on Maven Central is a third-party
  republish (`io.github.CshtZrgk:jp2-android`), so the decoder choice is **deferred** pending a
  deliberate supply-chain decision for this biometric wallet.
- **MRZ OCR** (`mrz.ts`) does not work on the New Architecture (ML Kit). Manual entry of the three key
  fields is the working path; the chip then supplies the rest off DG1.
- **Passive auth is MVP** (DG-hash integrity only). Production must also verify the EF.SOD CMS
  signature and chain the Document Signer Cert to a trusted CSCA masterlist before trusting
  `chipAuthenticated`. Server-side verification belongs in `hovi-issue-passport`.
