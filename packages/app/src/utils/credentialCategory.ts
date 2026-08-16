import type { MessageDescriptor } from '@lingui/core'
import { defineMessage } from '@lingui/core/macro'
import { LucideIcons } from '@package/ui'
import type { ComponentType } from 'react'

/**
 * Display categories for credentials. This is ZADA's own presentation-layer taxonomy (card colour,
 * icon, wallet grouping) — unrelated to the paradym `CredentialCategoryMetadata` record metadata,
 * which exists for canonical-record bookkeeping (e.g. 'DE-PID'), not display.
 */
export type CredentialCategoryId = 'identity' | 'health' | 'education' | 'work' | 'finance' | 'travel' | 'other'

type CategoryIcon = ComponentType<{ size?: number; color?: string; strokeWidth?: number }>

export interface CredentialCategoryTheme {
  id: CredentialCategoryId
  label: MessageDescriptor
  /**
   * Card body colour. Undefined for 'other': those cards fall back to the issuer's own
   * background colour or the name-seeded ZADA palette.
   */
  color?: string
  icon: CategoryIcon
  /** Sort order for grouped views; lower renders first. */
  order: number
}

/**
 * All category colours are deep/low-luminance (white text always passes) and sit in the same
 * navy/teal/earth family as `zadaCardPalette`, so themed and fallback cards blend in one wallet.
 */
export const credentialCategories: Record<CredentialCategoryId, CredentialCategoryTheme> = {
  identity: {
    id: 'identity',
    label: defineMessage({ id: 'credentialCategory.identity', message: 'Identity' }),
    color: '#1E3A5F',
    icon: LucideIcons.Fingerprint,
    order: 0,
  },
  health: {
    id: 'health',
    label: defineMessage({ id: 'credentialCategory.health', message: 'Health' }),
    color: '#0F6E56',
    icon: LucideIcons.HeartPulse,
    order: 1,
  },
  education: {
    id: 'education',
    label: defineMessage({ id: 'credentialCategory.education', message: 'Education' }),
    color: '#3C3489',
    icon: LucideIcons.GraduationCap,
    order: 2,
  },
  work: {
    id: 'work',
    label: defineMessage({ id: 'credentialCategory.work', message: 'Work' }),
    color: '#3F3F46',
    icon: LucideIcons.Briefcase,
    order: 3,
  },
  finance: {
    id: 'finance',
    label: defineMessage({ id: 'credentialCategory.finance', message: 'Finance' }),
    color: '#155E63',
    icon: LucideIcons.Wallet,
    order: 4,
  },
  travel: {
    id: 'travel',
    label: defineMessage({ id: 'credentialCategory.travel', message: 'Travel' }),
    color: '#7C2D12',
    icon: LucideIcons.Plane,
    order: 5,
  },
  other: {
    id: 'other',
    label: defineMessage({ id: 'credentialCategory.other', message: 'Other' }),
    color: undefined,
    icon: LucideIcons.FileBadge,
    order: 6,
  },
}

/**
 * Keyword → category mapping, matched as SUBSTRINGS against the credential's type identifier
 * (vct / doctype) and display name — so every keyword must be safe inside longer words and URLs.
 * Known traps that shaped this list: 'national' ⊂ "International Hospital", 'work' ⊂
 * "zada.network" (vcts are URLs), bare 'pid' ⊂ "rapid". Order matters: earlier categories win,
 * so health precedes identity ("Vaccination Record — Ar Yu International" must not hit identity
 * via 'nation...') and finance ("Health Insurance" is health). This is a client-side fallback
 * taxonomy — if the hub's type-metadata feed ever publishes an explicit category per vct, that
 * should take precedence over this matching.
 */
const categoryKeywords: [CredentialCategoryId, string[]][] = [
  ['health', ['health', 'vaccin', 'immuni', 'medical', 'patient', 'hospital', 'clinic', 'covid', 'prescription']],
  [
    'identity',
    [
      'passport',
      'identity',
      'zada id',
      'zadaid',
      '.pid',
      ':pid',
      'national id',
      'citizen',
      'residen',
      'licen',
      'kyc',
      'nrc',
    ],
  ],
  [
    'education',
    ['educat', 'student', 'degree', 'diploma', 'universit', 'school', 'academ', 'graduat', 'training', 'course'],
  ],
  ['work', ['employ', 'staff', 'occupation', 'profess', 'signing', 'workplace', 'work permit']],
  ['finance', ['loyal', 'bank', 'loan', 'financ', 'payment', 'insurance', 'credit']],
  ['travel', ['visa', 'travel', 'boarding', 'flight', 'ticket']],
]

/**
 * Resolve the display category for a credential from its type identifier(s) and display name.
 * Falls back to 'other' (no themed colour) when nothing matches.
 */
export function getCredentialCategory(input: {
  type?: string
  additionalTypes?: string[]
  name?: string
}): CredentialCategoryTheme {
  const haystack = [input.type, ...(input.additionalTypes ?? []), input.name].filter(Boolean).join(' ').toLowerCase()

  for (const [categoryId, keywords] of categoryKeywords) {
    if (keywords.some((keyword) => haystack.includes(keyword))) {
      return credentialCategories[categoryId]
    }
  }

  return credentialCategories.other
}
