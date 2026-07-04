# ZADA Edge Wallet — status

**As of:** 2026-07-04 · **App:** ZADA (`com.zadanetwork.wallet`), easypid `v1.20.1` ·
**Single branch:** `main` (GitHub `origin` and local are in sync)

This is the current, verified state of `zada-wallet-v2` (the `apps/easypid` Expo/Credo app).
It is a fork of Animo's paradym-wallet with ZADA wiring on top.

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

Build the ZADA test APK from `apps/easypid` (Node ≥22, `corepack pnpm`):

```
EXPO_PUBLIC_APP_TYPE=PARADYM_WALLET npx eas-cli build \
  --profile paradym-preview --platform android --non-interactive
```

- `paradym-preview` = ZADA-branded internal **APK**, `resourceClass: large` (paid plan),
  `android.buildArchs: ['arm64-v8a']` (avoids free-tier Gradle OOM; add ABIs back for store builds).
- Keystore is server-managed. **EAS builds from committed, git-tracked files** — commit first;
  verify inclusion with `git ls-files <path>`.
- **Verify native code actually shipped:** `unzip -p app.apk 'classes*.dex' | strings | grep -c
  "<package/path>"` (compare against a known-present control). "Build success" ≠ "your code is in
  the binary". Full detail in `docs/eas-build-notes.md`.
- **Latest build:** kicked off from `6f10c09` (onboarding + i18n). Rebuild from `a73a7b5` to include
  the cold-credential feature.

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
