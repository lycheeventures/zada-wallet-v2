import { Circle, Path, Rect, Svg } from 'react-native-svg'

/**
 * Onboarding illustration — "Your official IDs, in your pocket".
 * A physical passport and a phone holding a digital ID card, merged with a verified checkmark.
 */
export function BuildIdentity() {
  return (
    <Svg width="100%" height="100%" style={{ aspectRatio: 1 }} viewBox="0 0 320 320" fill="none">
      {/* soft brand blob */}
      <Path
        d="M92 24C142 24 186 8 226 40c40 32 74 66 62 122-12 56-52 82-108 92-56 10-118 6-146-44C6 262 30 210 34 160 38 100 42 24 92 24Z"
        fill="#EEF0FE"
      />

      {/* passport (physical) */}
      <Rect x="66" y="96" width="104" height="140" rx="12" fill="#202EA7" transform="rotate(-9 118 166)" />
      <Circle cx="112" cy="150" r="20" fill="#7A88FF" transform="rotate(-9 118 166)" />
      <Rect x="90" y="188" width="56" height="8" rx="4" fill="#ACB4FB" transform="rotate(-9 118 166)" />
      <Rect x="90" y="204" width="40" height="8" rx="4" fill="#ACB4FB" transform="rotate(-9 118 166)" />

      {/* phone with digital ID card */}
      <Rect x="150" y="84" width="118" height="176" rx="20" fill="#FFFFFF" stroke="#E0E3E8" strokeWidth="3" />
      <Rect x="166" y="108" width="86" height="60" rx="10" fill="#5A33F6" />
      <Circle cx="186" cy="132" r="12" fill="#DADEFF" />
      <Rect x="206" y="122" width="34" height="7" rx="3.5" fill="#ACB4FB" />
      <Rect x="206" y="138" width="24" height="7" rx="3.5" fill="#ACB4FB" />
      <Rect x="166" y="184" width="86" height="9" rx="4.5" fill="#E0E3E8" />
      <Rect x="166" y="202" width="64" height="9" rx="4.5" fill="#E0E3E8" />
      <Rect x="166" y="220" width="72" height="9" rx="4.5" fill="#E0E3E8" />

      {/* verified check badge */}
      <Circle cx="222" cy="238" r="26" fill="#31C66C" stroke="#FFFFFF" strokeWidth="4" />
      <Path
        d="M211 238l7 7 14-15"
        stroke="#FFFFFF"
        strokeWidth="4.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  )
}
