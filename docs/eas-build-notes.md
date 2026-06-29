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
