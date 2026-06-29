import type { ColorTokens } from 'tamagui'

import { hexColors } from '../config/tamagui.config'
/**
 * Get text color (white or black) for specific background color
 */
export function getTextColorBasedOnBg(bgColor: string) {
  return Number.parseInt(bgColor.replace('#', ''), 16) > 0xffffff / 2 ? '$grey-900' : '$grey-100'
}

/**
 * Curated ZADA card palette. Used as a deterministic fallback background when an issuer does not
 * supply its own `background_color`, so cards from different issuers/types look distinct instead of
 * all rendering in the same grey. Issuer-provided colors always take precedence. Colours are kept
 * dark enough that {@link getTextColorBasedOnBg} resolves to light text on all of them.
 */
export const zadaCardPalette = [
  '#1B2A4A', // navy
  '#0E5A4F', // emerald
  '#5B2B82', // purple
  '#8A2D3B', // wine
  '#1F6F8B', // ocean
  '#9C5A1D', // ochre
  '#2E5339', // forest
  '#7A3E9D', // violet
  '#34495E', // slate
  '#9C3848', // rose
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
