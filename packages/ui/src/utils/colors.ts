import type { ColorTokens } from 'tamagui'

import { hexColors } from '../config/tamagui.config'
/**
 * Get text color (white or black) for a given background color, using perceptual luminance
 * (ITU-R BT.601). Light backgrounds get dark text; dark backgrounds get light text. Falls back to
 * light text for non-hex inputs (e.g. tamagui tokens), matching the previous default.
 */
export function getTextColorBasedOnBg(bgColor: string) {
  const hex = bgColor.replace('#', '')
  const r = Number.parseInt(hex.slice(0, 2), 16)
  const g = Number.parseInt(hex.slice(2, 4), 16)
  const b = Number.parseInt(hex.slice(4, 6), 16)
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return '$grey-100'
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.6 ? '$grey-900' : '$grey-100'
}

/**
 * Curated ZADA card palette. Used as a deterministic fallback background when an issuer does not
 * supply its own `background_color`, so cards from different issuers/types look distinct instead of
 * all rendering in the same grey. Issuer-provided colors always take precedence. All colours are
 * deep and low-luminance (so {@link getTextColorBasedOnBg} always yields white text) and sit in the
 * navy/teal/earth family around the ZADA brand navy — no bright purples.
 */
export const zadaCardPalette = [
  '#1E293B', // slate navy
  '#0F4C5C', // deep teal
  '#14532D', // forest green
  '#7C2D12', // burnt sienna
  '#1E3A5F', // ocean navy
  '#3F3F46', // graphite
  '#155E63', // pine teal
  '#8C2F39', // brick red
  '#334155', // steel slate
  '#164E63', // cyan navy
] as const

/**
 * Deterministically pick a card background color from {@link zadaCardPalette} based on a stable
 * seed (e.g. the credential name / type). The same seed always yields the same color, so a given
 * credential keeps one consistent colour across the list, detail and share screens.
 */
export function pickCredentialBackgroundColor(seed: string): string {
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0
  }
  return zadaCardPalette[Math.abs(hash) % zadaCardPalette.length]
}

/**
 * Darken the shade of a custom color based on the hex color and a percentage
 * used to dynamically create onPress styling for custom colors
 */
export function darken(color: string | ColorTokens, percent: number): string {
  const hexColor = color.startsWith('#')
    ? color
    : ((hexColors as Record<string, string>)[color.startsWith('$') ? color.slice(1) : color] as string)
  const f = Number.parseInt(hexColor.slice(1), 16)
  const t = percent < 0 ? 0 : 255
  const p = percent < 0 ? percent * -1 : percent
  const R = f >> 16
  const G = (f >> 8) & 0x00ff
  const B = f & 0x0000ff
  return `#${(
    0x1000000 +
    (Math.round((t - R) * p) + R) * 0x10000 +
    (Math.round((t - G) * p) + G) * 0x100 +
    (Math.round((t - B) * p) + B)
  )
    .toString(16)
    .slice(1)}`
}
