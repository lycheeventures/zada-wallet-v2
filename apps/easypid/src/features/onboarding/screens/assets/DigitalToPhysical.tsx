import { Path, Rect, Svg } from 'react-native-svg'

/**
 * Onboarding illustration — "From digital to your wall".
 * A digital credential (with QR) turning into a framed, printable certificate for offline use.
 */
export function DigitalToPhysical() {
  return (
    <Svg width="100%" height="100%" style={{ aspectRatio: 1 }} viewBox="0 0 320 320" fill="none">
      {/* soft brand blob */}
      <Path
        d="M96 22c50-8 110 2 138 46 28 44 22 106-10 146-32 40-96 46-150 32C20 232-6 172 8 118 22 64 46 30 96 22Z"
        fill="#EEF0FE"
      />

      {/* digital credential (left, tilted) */}
      <Rect x="44" y="112" width="112" height="150" rx="12" fill="#5A33F6" transform="rotate(-8 100 187)" />
      {/* mini QR */}
      <Rect x="66" y="134" width="14" height="14" rx="2" fill="#FFFFFF" transform="rotate(-8 100 187)" />
      <Rect x="86" y="134" width="14" height="14" rx="2" fill="#FFFFFF" transform="rotate(-8 100 187)" />
      <Rect x="66" y="154" width="14" height="14" rx="2" fill="#FFFFFF" transform="rotate(-8 100 187)" />
      <Rect x="86" y="154" width="8" height="8" rx="1" fill="#ACB4FB" transform="rotate(-8 100 187)" />
      <Rect x="66" y="188" width="72" height="8" rx="4" fill="#DADEFF" transform="rotate(-8 100 187)" />
      <Rect x="66" y="204" width="52" height="8" rx="4" fill="#DADEFF" transform="rotate(-8 100 187)" />

      {/* transform arrow */}
      <Path d="M150 172c14-6 30-6 44 0" stroke="#6D7581" strokeWidth="4" strokeLinecap="round" fill="none" />
      <Path
        d="M188 164l10 8-10 8"
        stroke="#6D7581"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />

      {/* framed physical certificate (right) */}
      <Rect x="176" y="96" width="104" height="140" rx="6" fill="#2F3338" />
      <Rect x="186" y="106" width="84" height="120" rx="3" fill="#FFFFFF" />
      <Rect x="200" y="120" width="56" height="9" rx="4.5" fill="#E0E3E8" />
      <Rect x="200" y="136" width="40" height="7" rx="3.5" fill="#E0E3E8" />
      <Rect x="200" y="176" width="56" height="7" rx="3.5" fill="#E0E3E8" />
      <Rect x="200" y="190" width="44" height="7" rx="3.5" fill="#E0E3E8" />
      {/* seal */}
      <Path d="M228 150m-15 0a15 15 0 1 0 30 0a15 15 0 1 0 -30 0" fill="#EEF0FE" stroke="#5A33F6" strokeWidth="3" />
      <Path
        d="M221 150l5 5 9-9"
        stroke="#5A33F6"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  )
}
