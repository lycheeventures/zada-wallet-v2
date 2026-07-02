import { Circle, Path, Rect, Svg, Text } from 'react-native-svg'

/**
 * Onboarding illustration — "Share only what is needed".
 * A request card where one attribute is shared (green check) and others stay hidden (dots),
 * with an "18+" proof badge — selective disclosure without revealing the exact data.
 */
export function PrivacyControl() {
  return (
    <Svg width="100%" height="100%" style={{ aspectRatio: 1 }} viewBox="0 0 320 320" fill="none">
      {/* soft brand blob */}
      <Path
        d="M100 20c52-6 108 6 134 52 26 46 18 104-14 142-32 38-92 44-146 32C20 234-8 176 6 122 20 68 48 26 100 20Z"
        fill="#EEF0FE"
      />

      {/* card */}
      <Rect x="56" y="70" width="180" height="180" rx="18" fill="#FFFFFF" stroke="#E0E3E8" strokeWidth="3" />

      {/* shared row — over 18, revealed */}
      <Circle cx="88" cy="108" r="14" fill="#31C66C" />
      <Path
        d="M82 108l4.5 4.5L96 103"
        stroke="#FFFFFF"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <Rect x="114" y="102" width="90" height="12" rx="6" fill="#2F3338" />

      {/* hidden row */}
      <Circle cx="88" cy="152" r="14" fill="#F2F4F6" stroke="#E0E3E8" strokeWidth="2" />
      <Rect x="114" y="146" width="70" height="12" rx="6" fill="#E0E3E8" />
      <Circle cx="196" cy="152" r="3" fill="#9CA5AF" />
      <Circle cx="208" cy="152" r="3" fill="#9CA5AF" />
      <Circle cx="220" cy="152" r="3" fill="#9CA5AF" />

      {/* hidden row */}
      <Circle cx="88" cy="196" r="14" fill="#F2F4F6" stroke="#E0E3E8" strokeWidth="2" />
      <Rect x="114" y="190" width="84" height="12" rx="6" fill="#E0E3E8" />
      <Circle cx="210" cy="196" r="3" fill="#9CA5AF" />
      <Circle cx="222" cy="196" r="3" fill="#9CA5AF" />

      {/* 18+ proof badge */}
      <Circle cx="236" cy="228" r="30" fill="#5A33F6" stroke="#FFFFFF" strokeWidth="4" />
      <Text x="236" y="236" fill="#FFFFFF" fontSize="20" fontWeight="bold" textAnchor="middle">
        18+
      </Text>
    </Svg>
  )
}
