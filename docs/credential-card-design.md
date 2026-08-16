# Credential card design & category system

Introduced in PR #32 (Aug 2026). The wallet's credential cards moved from "one flat issuer colour
with a logo floated on it" to a two-part card that encodes what KIND of credential it is.

## Card anatomy (`packages/app/src/components/FunkeCredentialCard.tsx`)

- **White identity banner (top):** issuer logo (32px, rounded), credential display name
  (no longer upper-cased/truncated), issuer name underneath, category icon on the right.
  A white banner is how physical cards solve logo contrast — issuer logos are arbitrary artwork
  and can never be guaranteed to sit well on arbitrary brand colours.
- **Category-themed body (bottom):** deep category colour, large low-opacity watermark icon
  (recognition at a glance), category label, "Issued on" date, chevron. Text is white — every
  category colour is deliberately low-luminance.

**Issuer branding is demoted by design.** The issuer's OpenID4VCI `background_color` /
`background_image` only style the body for *uncategorised* types (then the name-seeded
`zadaCardPalette` as last resort). Type identity helps the holder more than issuer branding does.
An issuer `background_image` still replaces the body entirely (the banner stays).

## Category taxonomy (`packages/app/src/utils/credentialCategory.ts`)

| Category | Colour | Icon | Example matches |
|---|---|---|---|
| health | `#0F6E56` | HeartPulse | Vaccination Record, Health Insurance |
| identity | `#1E3A5F` | Fingerprint | ZADA ID, Passport, driver licence, EUDI PID |
| education | `#3C3489` | GraduationCap | degrees, student IDs, training certs |
| work | `#3F3F46` | Briefcase | Employee ID, Proof of Signing |
| finance | `#155E63` | Wallet | loyalty, loans, banking |
| travel | `#7C2D12` | Plane | visas, boarding passes |
| other | (fallback) | FileBadge | anything unmatched |

Matching is **substring keywords** over `vct` + display name. Two hard-won rules, documented in
the module and enforced by its ordering:

1. **Every keyword must be substring-safe inside URLs and longer words** — vcts are URLs:
   `'work'` ⊂ `zada.network`, `'national'` ⊂ "International Hospital", bare `'pid'` ⊂ "rapid".
2. **Order matters, health before identity** — so "Vaccination Record — Ar Yu International"
   can never resolve to identity via `nation…`, and health beats finance for "Health Insurance".

**Long-term:** the hub's type-metadata (wire-vct) feed should publish an explicit `category` per
vct; when it does, that takes precedence and the keyword matcher becomes the fallback for foreign
credentials. Until then, adding a category or keyword = editing this one module.

## Grouped wallet list (`FunkeCredentialsScreen`)

- Cards are always sorted by category order (identity first) — the most-used cards stay on top.
- With **more than 6 cards**, the fan-stack splits into category sections (icon + label header).
  Below that, sections would be more chrome than signal (one card per group), so the list stays
  a flat stack. Search results always render flat.
- The stack overlap (`mt={-120}`) leaves each card's white banner visible, so the stacked list
  reads like a physical card wallet.

## i18n

Category labels are lingui messages (`credentialCategory.*`), translated in all six locales.
Remember: the `sw` locale folder is **Swedish** (see repo `CLAUDE.md`). New categories need the
full translation workflow (extract → translate → merge → compile).
