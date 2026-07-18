# ZADA Edge Wallet — status

**As of:** 2026-07-18 · **App:** ZADA (`com.zadanetwork.wallet`), easypid `v1.20.1` (versionCode 210)

This is the current, verified state of `zada-wallet-v2` (the `apps/easypid` Expo/Credo app).
It is a fork of Animo's paradym-wallet with ZADA wiring on top.

---

## 0. Production release status (2026-07-18)

> **The v2 wallet is now migrating from internal testing to the public stores. This section is the
> single source of truth for release state; the older §6 below is background.**

**⚠️ v2 replaces the live legacy wallet IN PLACE.** `com.zadanetwork.wallet` is an existing,
published app on *both* stores, not a new listing:
- **Google Play:** "ZADA Digital Identity Wallet", seller ZADA Solutions, **live release
  209 (1.6.9)**, ~5,245 active installs (mostly Myanmar). Publishing v2 auto-updates these users.
- **Apple App Store:** "ZADA Wallet" **v1.6.8**, ASC id **1578666669**, seller Lychee Ventures Ltd.

Because the package/bundle id is identical, a store release is an **update** to the legacy app, not
a fresh install. Existing users land in a fresh v2 wallet; **credential migration is user-initiated
and not yet auto-prompted** (follow-up tracked — see §8). This was an explicit product decision
(replace in place, full rollout), taken 2026-07-18.

### Android — ✅ submitted as DRAFT, awaiting manual publish

- **AAB build `91e343b7`** (EAS, profile `paradym-production-android`), easypid **1.20.1 /
  versionCode 210**, ABIs **arm64-v8a + armeabi-v7a**, signed with the **real Play upload key**
  (`CN=Zada`, alias `key0`; cert SHA-256 `F7:EA:0E:7B…`, verified against Play's registered upload
  key — byte-identical).
- **Submitted** to the Play **production track** as a **DRAFT** release (submission `0a4da10b`).
  Confirmed via Play API: draft `1.20.1 / 210` sits beside the live `209 (1.6.9)`; nothing has
  reached users.
- **Your remaining step:** Play Console → *Test and release → Production* → review the draft, add
  release notes, and **Start rollout** (that click = full rollout to all users). Consider a staged %
  in the Console UI for a first EAS release.

### iOS — deferred to a separate session (playbook in §6b)

No new build required and **no certificate to recover** — a finished App Store (`store`) build of
current `main` already exists: **build `17c28255`**, commit `395d0d4`, buildNumber 12.

---

## 1. TL;DR

- **`main` is the single source of truth.** All ZADA feature lines (passport NFC, issuer trust,
  credential migration, home redesign, onboarding, cold-credential offline share, support chat,
  document catalog / Myanmar DL, batch import) plus the latest UX + bug fixes are squashed into
  `main`. Every old `zada/*` and `feat/*` branch has been merged/superseded and **deleted** (local
  and origin). Working tree clean; typecheck has no new errors.
- **Latest fixes on `main`:** stacked card layout + always-readable card text, white ZADA logo +
  bottom Scan button, keyboard-safe support chat, Create ZADA ID / Migrate in the menu, DL scan
  (issuer pointed at `vli.zada.solutions`, not the auth-stripping lovable.app redirect;
  case-insensitive RTAD URL match), and biometrics enable on software-backed keystores (upstream #535).
- **i18n is complete** for `en, de, nl, fi, pt, sw, al` — only obsolete strings remain untranslated.
- Latest **paradym-preview APK** built from the pre-cleanup `wallet-ux-fixes` tip
  (`908766e`, without the biometrics commit); rebuild from `main` to include biometrics.

---

## 1b. Planned: upstream paradym-wallet re-sync

Our fork point is `fecdfbf` (easypid 1.20.1). Upstream (`animo/paradym-wallet`) is **~42 commits
ahead**, including two structural changes we have **not** taken — **`#470` "wallet SDK"** (major
refactor) and **`#549` Expo 56**. Consequences:

- Most post-#470 fixes are entangled with that refactor, so per-commit cherry-picks are only
  feasible for small isolated changes (e.g. we already took the keystore-gate part of **`#535`**
  biometrics fix; the rest of #535 is SDK-bound).
- A proper catch-up is a **deliberate re-sync project** (rebase/merge onto the wallet-SDK + Expo 56
  base) with real conflicts expected in our heavily-customized **trust** and **onboarding** code —
  not something to do mid-bugfix.
- Candidates to evaluate individually when we do it: privacy `#558`, credential deletion `#534`,
  reset `#537`, deeplink `#533`, reanimated warning `#547`. The **trust** PRs (`#540/#543/#531/#536`)
  overlap our ZADA registry/x509 work and need manual reconciliation, not blind cherry-picks.

---

## 2. Stack & identity

- **Runtime:** Expo / React-Native + Credo (`@credo-ts/*`), Tamagui UI (`@package/ui`), lingui i18n.
- **Monorepo:** pnpm workspaces (`corepack pnpm`); apps/easypid + packages/{agent,app,ui,scanner,secure-store,translations,utils}.
- **Build/release:** EAS, account `zada-solutions` (Owner), project `zada-edge-wallet`
  (`898f5f59-f246-4fa4-b73d-0140443f967b`), owner set in `base.app.config.js`.
- **App config:** `EXPO_PUBLIC_APP_TYPE=PARADYM_WALLET` selects the **ZADA** build (name "ZADA",
  bundle `com.zadanetwork.wallet`). `FUNKE_WALLET` is Animo's — ignore it.
- **Migration hand-off URL:** `credentialMigrationUrl` defaults to `https://migrate.zada.solutions`
  (`base.app.config.js`), overridable via `CREDENTIAL_MIGRATION_URL`.

---

## 3. Branch topology (historical — all consolidated into `main` on 2026-07-04)

> These branches have since been **merged/superseded into `main` and deleted** (local + origin).
> The table is kept only to record where each feature line originated.


| Branch | HEAD | Role | Contained in `wallet-ux-redesign`? |
|---|---|---|---|
| `main` | `1e5c681` | Upstream + merged passport-import PRs | base |
| `zada/issuer-trust-anchor` | `d7ef108` | Crypto-anchor ZADA issuer trust (ADR-0002) | ✅ |
| `zada/credential-x5c-trust` | `552a30f` | Verify issuer trust from credential x5c (Path B) | ✅ |
| `zada/credential-migration` | `e0d04c2` | Legacy credential re-claim via credential-key-usher web flow | ✅ |
| `zada/passport-full` | `d8cdfc2` | NFC passport (MRZ + chip) → Hovi issuance; native module | ✅ |
| `zada/cold-credential-share` | `3da391a` | Offline PDF & QR (trust-bound-roots cold credential) | ✅ (merged `a73a7b5`) |
| `zada/combined` | `67e275b` | Older integration branch | superseded |
| **`zada/wallet-ux-redesign`** | **`a73a7b5`** | **Home + onboarding redesign; the unified integration branch** | — |

> **Consolidation note:** `zada/wallet-ux-redesign` and `zada/cold-credential-share` both branched
> from `bc79c1f` and touched disjoint files, so the merge was conflict-free. `zada/combined` is an
> earlier consolidation and is no longer the integration target — prefer `wallet-ux-redesign`.

---

## 4. Feature inventory

**Trust & issuance (ADR-0002)**
- Issuer trust is cryptographically anchored; the wallet verifies an issuer from the credential's
  `x5c` chain (`packages/agent/.../zadaTrust.ts`, `utils/trust.ts`).
- Offer-time **registry recognition** — when metadata isn't x5c-signed, the wallet falls back to a
  ZADA trust-registry lookup by issuer URL (no crypto), surfaced as a *distinct honest* state
  ("In ZADA Trust Registry", info-blue) — never shown as the green "Verified by ZADA Network" badge.
  A *failed* signature is never downgraded to registry trust.

**Passport (ICAO 9303 / EUDI-PID)**
- MRZ scan + OCR, NFC chip read (jMRTD/CoreNFC), issuance via Hovi. App-local Expo native module
  `apps/easypid/modules/passport-nfc` (autolinked on EAS — see `docs/eas-build-notes.md`).

**Credential migration**
- User-initiated, per-credential re-claim: hands off to the credential-key-usher web flow in a
  browser; claimed credentials return as `openid-credential-offer://` deep links.

**Cold credential (offline share)**
- "Offline PDF & QR code" — generates a verifiable QR + PDF (trust-bound-roots) that a verifier can
  scan offline, from the credential detail screen (`ColdCredentialSheet.tsx`, `useShareCredential`).

**Official-document catalog + Myanmar driver license (2026-07-02, PR #14)**
- Home "Add passport" generalized to **"Add an official document"** → `/documents` catalog screen
  (Passport via NFC, Myanmar driver license via QR); menu entry "Add a document" keeps it reachable.
- **MDL flow** (`apps/easypid/src/features/documents/`): scan the QR on the license/RTAD receipt →
  POST the URL to the **verifiable-link-issuer** (`EXPO_PUBLIC_DOCUMENT_ISSUER_URL`, default
  `https://vli.zada.solutions`; Bearer `EXPO_PUBLIC_DOCUMENT_ISSUER_API_KEY`) → the returned
  OpenID4VCI offer is received in-session on the normal credential rail (no deeplink bounce).
  Issued by ZADA Solutions via Hovi (credential template `88bc90cf…`, hub schema `eb03654e…`).
- `documentSources.ts` mirrors the issuer's allow-list (mdl.rtad.gov.mm `/detail` + `id`,`nrc`) for
  instant feedback; source URLs carry the holder's NRC so they travel via an in-memory stash, never
  router params. The main scanner recognizes document QRs via a new `interceptScan` hook on
  `QrScannerScreen`. Backend e2e verified by curl 2026-07-02 (offer minted end-to-end).

**Home & onboarding (this session — see §5)**

---

## 5. This session's changes (2026-07-01)

**Onboarding redesign** (`6f10c09`) — production-ready flow:
`welcome → intro (new 4-slide carousel) → pin → pin-reenter → biometrics → data-protection →
setup-zada-id (new)`.
- New screens: `screens/intro.tsx` (education carousel), `screens/setup-zada-id.tsx` (Screen 9 —
  verifies phone & email via `startMigration()`, then finishes onboarding; "Set up later" skips).
- New in-brand SVG illustrations: `BuildIdentity`, `PrivacyControl`, `DigitalToPhysical`
  (`screens/assets/`) — geometric placeholders, swap for brand art anytime.
- Restyled landing copy; added the app-deletion warning to the data-protection subtitle.

**Home cleanup** (`FunkeWalletScreen.tsx`):
- Removed the first-launch `MigrationWelcomeSheet` popup (deleted the file; its role moved into
  onboarding Screen 9).
- Removed the "Hello!" header and the "Present in-person" tile; made "Scan QR-code" a full-width
  button; renamed the getting-started section to "Set up your wallet".
- "Present in-person" relocated to the menu (WALLET section → `/offline`).

**Consolidation** (`a73a7b5`) — merged `zada/cold-credential-share` in (conflict-free).

**i18n** — full lingui pass: translated all outstanding strings (onboarding + cold-credential +
leftovers) into `de, nl, fi, pt, sw, al`; catalogs recompiled. Remaining untranslated strings are
obsolete-only.

---

## 6. Build & release (EAS)

**EAS project:** `@zada-solutions/zada-edge-wallet` (`898f5f59-f246-4fa4-b73d-0140443f967b`).
Account is on a paid plan but currently running **pay-as-you-go overages** — each build costs.
**EAS builds from committed, git-tracked files** — commit first; `git ls-files <path>` shows exactly
what reaches the builder. Verify native code actually shipped (`docs/eas-build-notes.md`): "build
success" ≠ "your code is in the binary".

### Build profiles (`apps/easypid/eas.json`)
- `paradym-preview` — internal **APK** (arm64 only historically).
- `paradym-production` — **store AAB/IPA**, `autoIncrement`, `resourceClass: large`. Shared by
  **iOS** (TestFlight/App Store) and, for **submit**, Android. `appVersionSource: remote` (EAS holds
  the version counters; Android versionCode is at **209** → next build 210; iOS buildNumber at 12).
- **`paradym-production-android`** — `extends paradym-production` + `credentialsSource: local`. Use
  this to build the **Android store AAB** so it signs with the **local upload keystore** without
  forcing the shared iOS profile to resolve local iOS credentials it doesn't have.
- `base.app.config.js` now builds **`['arm64-v8a', 'armeabi-v7a']`** for the store (32-bit devices
  are common in the user base; free in an AAB — Play splits per device).

### Android store release (reproduce the 2026-07-18 release)

Signing/publishing secrets are **not in the repo** — they live in
`~/Documents/claudecode/wallet keys/` (`zada.keystore`, `keystore.txt`, the Play service-account
JSON). The keystore is the original **upload key** recovered from the previous developer's setup
its alias and passwords are recorded in `keystore.txt` beside it (do **not** copy secrets into this
repo). See `credentials.json` note below.

```bash
cd apps/easypid
# 1. Build the store AAB (signs with the local upload keystore via credentials.json)
EXPO_PUBLIC_APP_TYPE=PARADYM_WALLET npx eas-cli build \
  -p android -e paradym-production-android --non-interactive
# 2. Submit the build to Play as a DRAFT on the production track
EXPO_PUBLIC_APP_TYPE=PARADYM_WALLET npx eas-cli submit \
  -p android -e paradym-production --id <BUILD_ID> --non-interactive
```

- **`apps/easypid/credentials.json` is git-ignored and machine-local** — it points EAS at the
  keystore + passwords. Recreate it if missing:
  ```json
  { "android": { "keystore": {
      "keystorePath": "/Users/andsig/Documents/claudecode/wallet keys/zada.keystore",
      "keystorePassword": "<see keystore.txt>", "keyAlias": "<see keystore.txt>",
      "keyPassword": "<see keystore.txt>" } } }
  ```
- **Service account:** `eas submit` has no `--key` flag; add `serviceAccountKeyPath` under
  `submit.paradym-production.android` in `eas.json` **locally only** (don't commit the machine path),
  pointing at `…/wallet keys/zada-wallet-0682e1084dbf.json`
  (`zada-wallet@zada-wallet.iam.gserviceaccount.com`, has Release-manager access — verified).
- `submit.paradym-production.android` is set to `track: production`, `releaseStatus: draft` — the
  upload lands as a reviewable draft; **no rollout happens until you publish in the Console.**
- **Verify a built AAB before submitting:** unzip it, check `base/lib/` for both ABIs, and extract
  `META-INF/KEY0.RSA` → the signer cert SHA-256 must equal the Play upload key `F7:EA:0E:7B…`
  (no Java on this Mac; use `openssl pkcs7 -inform DER -print_certs`).

### 6b. iOS store release — next-session playbook

**No certificate to recover** (unlike Android): Apple manages App Store signing; the distribution
cert + provisioning profile are already stored in EAS (proven by existing `store`-distribution iOS
builds). The same cert that built TestFlight builds signs the App Store release; TestFlight and App
Store share one binary.

1. **Build** — optional. A finished `store` build of current `main` already exists:
   **`17c28255`** (commit `395d0d4`, buildNumber 12). Only build fresh if `main` has moved:
   `EXPO_PUBLIC_APP_TYPE=PARADYM_WALLET npx eas-cli build -p ios -e paradym-production --non-interactive`.
2. **Deliver to App Store Connect** — `eas submit -p ios -e paradym-production --id 17c28255`
   (`submit.paradym-production.ios.ascAppId = 1578666669`). This lands in ASC/TestFlight, **not** the
   public store.
3. **Release** — this part is **manual in App Store Connect** (`eas submit` can't do it): create a
   new App Store version `1.20.1` (valid: 1.20.1 > live 1.6.8), attach the build, complete metadata
   (what's-new, screenshots, **App Privacy** answers, export compliance, age rating), **Submit for
   Review**. Apple review ~1–3 days (identity/wallet apps can draw extra scrutiny), then release.
4. Same in-place-replacement + un-prompted-migration caveat as Android (§0, §8).

---

## 7. Internationalization

- **Languages:** `en` (source) + `de, nl, fi, pt, sw, al`. Source strings use lingui macros;
  `messages.ts` catalogs are compiled from `messages.json`.
- **Workflow** (repo `CLAUDE.md`): `translations:extract` → per-locale `extract-missing-translations`
  → translate `missing.json` (per-locale `AI_INSTRUCTIONS.MD`) → `merge-missing-translations` →
  `translations:extract` + `translations:compile` → `style:fix`.
- **State:** all live strings translated; the only untranslated entries are obsolete (e.g. the
  removed `migrationWelcome.*` popup strings), which don't render.

---

## 8. Known issues & follow-ups

- **⚠️ RELEASE-CRITICAL: no first-run migration prompt.** When ~5,245 legacy Play users (and the
  iOS users) auto-update to v2, they land in an empty wallet with **no prompt** to migrate — they
  must find "Migrate credentials" / "Create ZADA ID" themselves
  (`features/migration/useCredentialMigration.tsx`, mmkv `hasZadaIdOnboarded`). Accepted for the
  first release; add a one-time detect-fresh-install → steer-to-migration sheet next (a
  `MigrationWelcomeSheet` existed on the old `zada/credential-migration` branch — reusable).
- **Secrets hygiene:** the legacy repo `lycheeventures/zada-wallet` has `private_key.pepk` committed
  (harmless — encrypted to Google — but should be cleaned). `EXPO_PUBLIC_DOCUMENT_ISSUER_API_KEY`
  (`vci_…`) + `EXPO_PUBLIC_SUPPORT_APP_KEY` are baked into the public bundle via `eas.json`; a public
  store release widens their exposure — plan a rotation.
- **Animo leftovers not blockers but debt:** `associatedDomains`/scheme are still Animo's
  (`paradym.id`, `paradymwallet.app`, `id.animo.paradym://`, mediator `did:web:mediator.paradym.id`).

- **`sw/AI_INSTRUCTIONS.MD` contains Swedish rules, not Swahili.** Translations were produced by
  applying the principles to Swahili, but this file should be rewritten for proper future passes.
- **5 pre-existing typecheck errors** (not from this work): `PassportScanScreen` TextInput
  `onChange` (×3), `useHeaderRightAction` `icon` prop (×2 — DeferredCredentialNotification,
  FunkeRequestedAttributesDetail). Worth fixing before a store release.
- **Onboarding illustrations** are geometric placeholders — swap for brand art in `screens/assets/`.
- **Not device-verified yet** — verify the onboarding carousel sizing, Screen 9 browser round-trip,
  and cold-credential share on a physical device from the new build.
- **Security red flags** from the Jun 2026 pass still stand where applicable (per-org secret gap,
  plaintext keys, SSRF, optional HMAC, public credential PDFs) — track separately.

---

## 9. Where things are

- Onboarding: `apps/easypid/src/features/onboarding/{steps.ts,onboardingContext.tsx,screens/}`
- Home: `apps/easypid/src/features/wallet/FunkeWalletScreen.tsx`
- Migration: `apps/easypid/src/features/migration/useCredentialMigration.tsx`
- Trust: `packages/agent/src/openid4vc/zadaTrust.ts`, `packages/agent/src/utils/trust.ts`
- Passport: `apps/easypid/src/features/passport/`, `apps/easypid/modules/passport-nfc/`
- Cold credential: `apps/easypid/src/features/wallet/ColdCredentialSheet.tsx`, `hooks/useShareCredential.tsx`
- Build notes: `docs/eas-build-notes.md`
