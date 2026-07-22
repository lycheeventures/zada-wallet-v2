# Building the ZADA edge wallet on EAS — notes & gotchas

Hard-won operational knowledge for compiling `apps/easypid` (the ZADA fork of paradym-wallet) to a
standalone Android APK. Written after the passport-NFC native-module integration (Jun 2026).

## The build, in one block

```bash
cd apps/easypid
# CLI is already authenticated; account is the EAS org "zada-solutions", project "zada-edge-wallet".
npx --no-install eas-cli build --platform android --profile paradym-preview --non-interactive --no-wait
# then:
npx --no-install eas-cli build:view <build-id>      # Status / Commit / Application Archive URL
```

- **Profile `paradym-preview`** → an internal-distribution **standalone APK** you sideload (uses a
  large resource class on the paid plan). This is NOT Expo Go.
- **You cannot use Expo Go.** The wallet depends on native modules (Askar, Credo, mdoc, and now
  passport-nfc) that Expo Go's prebuilt runtime doesn't contain. A dev client or a standalone build is
  mandatory — "it worked in Expo Go" was never true for issue/verify; that was always a dev/standalone
  build.
- **New Architecture is ON** (Expo SDK 54 default). Some libraries misbehave under New Arch — notably
  ML Kit text recognition (the MRZ OCR), which is why manual entry is the working passport path.
- **pnpm monorepo**, `node-linker=hoisted`. `eas-build-pre-install` runs `corepack enable` so the
  builder uses the repo's pinned pnpm.

## Verify what's in the APK — grep the dex, don't assume

The highest-leverage debugging technique. EAS build "success" does **not** mean your code is in the
binary (autolinking can silently skip a module). Prove it:

```bash
curl -sL -o app.apk "<Application Archive URL>"
unzip -p app.apk 'classes*.dex' | strings | grep -c "<your/package/path>"   # 0 = NOT compiled in
```

Always compare against a **control** (a module you know is present, e.g. `animo/mdoc`) so a `0` means
"missing", not "bad grep".

## Native module autolinking (the big trap in a monorepo)

EAS uploads a **shallow git clone of git-tracked files only** — `git ls-files <path>` is the exact
manifest of what the builder receives. Local working-tree files that aren't committed (or are
`.gitignore`d) simply aren't there.

For an **app-local** Expo module under `apps/easypid/modules/<name>` to be autolinked on EAS:

1. The dir must contain **both `package.json` and `expo-module.config.json`** (missing either →
   silently skipped, no error, absent from the gradle "Using expo modules" list).
2. Its native sources must be **git-tracked and reach the builder**. Beware broad `.gitignore` rules
   (a bare `android`/`ios` for prebuild output) swallowing the module's `android/` dir. **Anchor**
   those rules to the app dir (`/apps/easypid/android`) rather than relying on a fragile
   parent-ignore + child-negation, which EAS does not honor like git does.

The local `expo-modules-autolinking resolve` CLI is **more lenient than EAS's gradle path** — it can
report a module as found when EAS will skip it. Trust the dex grep, not local resolve.

To see the builder's filesystem directly, temporarily set
`"eas-build-pre-install": "corepack enable; ls -laR modules/<name>"` and read the EAS
**"Install dependencies"** log.

## Things that wasted time (so you don't repeat them)

- **Raw i18n keys / blank buttons.** Lingui strings must be extracted+compiled
  (`pnpm translations:extract && pnpm translations:compile` in `apps/easypid`). And **Tamagui `Button`
  renders STRING children only** — use `t({id,message})`, not a `<Trans>` element child, or the button
  shows blank.
- **A top-level `requireNativeModule('X')`** at import time throws and white-screens the route if the
  module isn't linked. Resolve it lazily/guarded (see `modules/passport-nfc/index.ts`).
- **`gh` defaulting to the upstream fork.** Set `gh repo set-default lycheeventures/zada-wallet-v2`
  (and pass `--repo`) or PR commands hit `animo/paradym-wallet`.

## Branch topology (Jun 2026)

`main` carries the passport import work (merged via PR #5). `zada/passport-full` is the passport
feature line. Other `zada/*` branches (`combined`, `credential-x5c-trust`, `issuer-trust-anchor`,
`credential-migration`) hold WIP not yet reconciled into `main` — notably an alternate home-screen
design. Re-verify the active home before UI work; don't assume a screenshot matches the branch.

## Building for iOS (first iOS build: Jul 2026)

The app had only ever been built for Android before. Getting the **first iOS archive** onto TestFlight
(`paradym-production` profile → App Store Connect app `1578666669`, bundle `com.zadanetwork.wallet`)
surfaced a chain of blockers — each hid the next, so it took several builds to clear them all. Fixes
landed on branch `zada/passport-ios-nfc-api-fixes`.

```bash
cd apps/easypid
npx --no-install eas-cli build --profile paradym-production --platform ios --non-interactive --no-wait
```

**The blocker chain, in order (each had to be fixed to reveal the next):**

1. **iOS credentials are interactive the first time.** A non-interactive `eas build` fails with
   "Distribution Certificate is not validated for non-interactive builds." Run `eas build` once
   *without* `--non-interactive` (Apple login + 2FA) to create/store the Distribution Certificate &
   provisioning profile; after that, non-interactive builds work.
2. **ML Kit (MRZ OCR) was removed entirely (2026-07).** `@react-native-ml-kit/text-recognition` was
   dropped from the passport flow — its prebuilt `libmlkit_google_ocr_pipeline.so` was **not
   16 KB-page-aligned**, which blocks Google Play releases for apps targeting API 35+ (all other native
   libs in the AAB are aligned; it was the sole offender). The OCR was already non-functional on the New
   Architecture, so `PassportScanScreen` now opens straight on manual MRZ entry. This also retired the
   old iOS-only pod-install workaround (ML Kit pulled the `GoogleMLKit` static-binary subtree, which
   CocoaPods refused under dynamic `use_frameworks!`) and the `react-native.config.js` file it lived in.
   To re-add OCR later, bump ML Kit to a 16 KB-aligned release (`com.google.mlkit:text-recognition:16.0.1`
   ships an aligned `libmlkit_google_ocr_pipeline.so`) rather than reverting to 16.0.0.
3. **Exposing NFCPassportReader to the app-local `PassportNfc` pod target** — see
   `modules/passport-nfc/README.md` → "iOS dependency wiring". Short version: use
   `s.pod_target_xcconfig` `FRAMEWORK_SEARCH_PATHS` in `PassportNfc.podspec`, **not**
   `s.dependency 'NFCPassportReader'` — the latter re-serializes `Pods.xcodeproj` and corrupts the eudi
   mdoc **SPM** refs ("The project 'Pods' is damaged" → `import Expo` no such module 'Expo').

**Toolchain notes.** Keep the EAS image at **Xcode 26+** (`macos-sequoia-15.6-xcode-26.0` in
`eas.json`) — Apple requires Xcode 26+ for App Store submission since 2026-04-28, and downgrading does
**not** fix the "Pods project is damaged" error (that was the `s.dependency` regression above, not the
Xcode version). Read the **actual EAS build duration** from the dashboard, not wall-clock around the
build — a shorter build usually means it failed *earlier*, not that it got further via cache.

**Submitting to TestFlight** (also interactive the first time):

```bash
cd apps/easypid
npx eas-cli submit -p ios --profile paradym-production --id <build-id>   # no --non-interactive
```

The first submit prompts to set up an **App Store Connect API Key** (Apple login + 2FA); it stores the
key so later submits can be non-interactive. `--non-interactive` fails with "App Store Connect API Keys
cannot be set up in --non-interactive mode." After upload, Apple processes the build (~5–15 min) before
it appears under TestFlight; a first build may also ask a one-time export-compliance question.

**On-device NFC test:** passport chip reading needs a **physical iPhone (7+/iOS 15+)** — it does not
work in the simulator.
