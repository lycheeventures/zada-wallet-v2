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
