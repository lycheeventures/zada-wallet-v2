// Phone helpers for the native ZADA ID flow. Ported 1:1 from credential-key-usher's
// `src/lib/phone.ts` (the web flow) so the number the wallet sends is byte-for-byte what the web
// flow would have sent: strict E.164, which is what the OTP providers (Twilio, smspoh) require.

export type Country = {
  /** ISO 3166-1 alpha-2 */
  code: string
  name: string
  /** dial code without "+" */
  dial: string
  flag: string
}

// Ordered with the markets that matter first, then alphabetical.
export const COUNTRIES: Country[] = [
  { code: 'MM', name: 'Myanmar', dial: '95', flag: '🇲🇲' },
  { code: 'LK', name: 'Sri Lanka', dial: '94', flag: '🇱🇰' },
  { code: 'IN', name: 'India', dial: '91', flag: '🇮🇳' },
  { code: 'SG', name: 'Singapore', dial: '65', flag: '🇸🇬' },
  { code: 'TH', name: 'Thailand', dial: '66', flag: '🇹🇭' },
  { code: 'AE', name: 'United Arab Emirates', dial: '971', flag: '🇦🇪' },
  { code: 'GB', name: 'United Kingdom', dial: '44', flag: '🇬🇧' },
  { code: 'US', name: 'United States', dial: '1', flag: '🇺🇸' },
  { code: 'AF', name: 'Afghanistan', dial: '93', flag: '🇦🇫' },
  { code: 'AL', name: 'Albania', dial: '355', flag: '🇦🇱' },
  { code: 'DZ', name: 'Algeria', dial: '213', flag: '🇩🇿' },
  { code: 'AR', name: 'Argentina', dial: '54', flag: '🇦🇷' },
  { code: 'AM', name: 'Armenia', dial: '374', flag: '🇦🇲' },
  { code: 'AU', name: 'Australia', dial: '61', flag: '🇦🇺' },
  { code: 'AT', name: 'Austria', dial: '43', flag: '🇦🇹' },
  { code: 'AZ', name: 'Azerbaijan', dial: '994', flag: '🇦🇿' },
  { code: 'BH', name: 'Bahrain', dial: '973', flag: '🇧🇭' },
  { code: 'BD', name: 'Bangladesh', dial: '880', flag: '🇧🇩' },
  { code: 'BY', name: 'Belarus', dial: '375', flag: '🇧🇾' },
  { code: 'BE', name: 'Belgium', dial: '32', flag: '🇧🇪' },
  { code: 'BT', name: 'Bhutan', dial: '975', flag: '🇧🇹' },
  { code: 'BO', name: 'Bolivia', dial: '591', flag: '🇧🇴' },
  { code: 'BA', name: 'Bosnia and Herzegovina', dial: '387', flag: '🇧🇦' },
  { code: 'BR', name: 'Brazil', dial: '55', flag: '🇧🇷' },
  { code: 'BN', name: 'Brunei', dial: '673', flag: '🇧🇳' },
  { code: 'BG', name: 'Bulgaria', dial: '359', flag: '🇧🇬' },
  { code: 'KH', name: 'Cambodia', dial: '855', flag: '🇰🇭' },
  { code: 'CM', name: 'Cameroon', dial: '237', flag: '🇨🇲' },
  { code: 'CA', name: 'Canada', dial: '1', flag: '🇨🇦' },
  { code: 'CL', name: 'Chile', dial: '56', flag: '🇨🇱' },
  { code: 'CN', name: 'China', dial: '86', flag: '🇨🇳' },
  { code: 'CO', name: 'Colombia', dial: '57', flag: '🇨🇴' },
  { code: 'CR', name: 'Costa Rica', dial: '506', flag: '🇨🇷' },
  { code: 'HR', name: 'Croatia', dial: '385', flag: '🇭🇷' },
  { code: 'CY', name: 'Cyprus', dial: '357', flag: '🇨🇾' },
  { code: 'CZ', name: 'Czechia', dial: '420', flag: '🇨🇿' },
  { code: 'DK', name: 'Denmark', dial: '45', flag: '🇩🇰' },
  { code: 'DO', name: 'Dominican Republic', dial: '1809', flag: '🇩🇴' },
  { code: 'EC', name: 'Ecuador', dial: '593', flag: '🇪🇨' },
  { code: 'EG', name: 'Egypt', dial: '20', flag: '🇪🇬' },
  { code: 'EE', name: 'Estonia', dial: '372', flag: '🇪🇪' },
  { code: 'ET', name: 'Ethiopia', dial: '251', flag: '🇪🇹' },
  { code: 'FI', name: 'Finland', dial: '358', flag: '🇫🇮' },
  { code: 'FR', name: 'France', dial: '33', flag: '🇫🇷' },
  { code: 'GE', name: 'Georgia', dial: '995', flag: '🇬🇪' },
  { code: 'DE', name: 'Germany', dial: '49', flag: '🇩🇪' },
  { code: 'GH', name: 'Ghana', dial: '233', flag: '🇬🇭' },
  { code: 'GR', name: 'Greece', dial: '30', flag: '🇬🇷' },
  { code: 'GT', name: 'Guatemala', dial: '502', flag: '🇬🇹' },
  { code: 'HK', name: 'Hong Kong', dial: '852', flag: '🇭🇰' },
  { code: 'HU', name: 'Hungary', dial: '36', flag: '🇭🇺' },
  { code: 'IS', name: 'Iceland', dial: '354', flag: '🇮🇸' },
  { code: 'ID', name: 'Indonesia', dial: '62', flag: '🇮🇩' },
  { code: 'IQ', name: 'Iraq', dial: '964', flag: '🇮🇶' },
  { code: 'IE', name: 'Ireland', dial: '353', flag: '🇮🇪' },
  { code: 'IL', name: 'Israel', dial: '972', flag: '🇮🇱' },
  { code: 'IT', name: 'Italy', dial: '39', flag: '🇮🇹' },
  { code: 'JM', name: 'Jamaica', dial: '1876', flag: '🇯🇲' },
  { code: 'JP', name: 'Japan', dial: '81', flag: '🇯🇵' },
  { code: 'JO', name: 'Jordan', dial: '962', flag: '🇯🇴' },
  { code: 'KZ', name: 'Kazakhstan', dial: '7', flag: '🇰🇿' },
  { code: 'KE', name: 'Kenya', dial: '254', flag: '🇰🇪' },
  { code: 'KW', name: 'Kuwait', dial: '965', flag: '🇰🇼' },
  { code: 'KG', name: 'Kyrgyzstan', dial: '996', flag: '🇰🇬' },
  { code: 'LA', name: 'Laos', dial: '856', flag: '🇱🇦' },
  { code: 'LV', name: 'Latvia', dial: '371', flag: '🇱🇻' },
  { code: 'LB', name: 'Lebanon', dial: '961', flag: '🇱🇧' },
  { code: 'LT', name: 'Lithuania', dial: '370', flag: '🇱🇹' },
  { code: 'LU', name: 'Luxembourg', dial: '352', flag: '🇱🇺' },
  { code: 'MO', name: 'Macao', dial: '853', flag: '🇲🇴' },
  { code: 'MY', name: 'Malaysia', dial: '60', flag: '🇲🇾' },
  { code: 'MV', name: 'Maldives', dial: '960', flag: '🇲🇻' },
  { code: 'MT', name: 'Malta', dial: '356', flag: '🇲🇹' },
  { code: 'MU', name: 'Mauritius', dial: '230', flag: '🇲🇺' },
  { code: 'MX', name: 'Mexico', dial: '52', flag: '🇲🇽' },
  { code: 'MD', name: 'Moldova', dial: '373', flag: '🇲🇩' },
  { code: 'MN', name: 'Mongolia', dial: '976', flag: '🇲🇳' },
  { code: 'MA', name: 'Morocco', dial: '212', flag: '🇲🇦' },
  { code: 'MZ', name: 'Mozambique', dial: '258', flag: '🇲🇿' },
  { code: 'NA', name: 'Namibia', dial: '264', flag: '🇳🇦' },
  { code: 'NP', name: 'Nepal', dial: '977', flag: '🇳🇵' },
  { code: 'NL', name: 'Netherlands', dial: '31', flag: '🇳🇱' },
  { code: 'NZ', name: 'New Zealand', dial: '64', flag: '🇳🇿' },
  { code: 'NG', name: 'Nigeria', dial: '234', flag: '🇳🇬' },
  { code: 'NO', name: 'Norway', dial: '47', flag: '🇳🇴' },
  { code: 'OM', name: 'Oman', dial: '968', flag: '🇴🇲' },
  { code: 'PK', name: 'Pakistan', dial: '92', flag: '🇵🇰' },
  { code: 'PS', name: 'Palestine', dial: '970', flag: '🇵🇸' },
  { code: 'PA', name: 'Panama', dial: '507', flag: '🇵🇦' },
  { code: 'PG', name: 'Papua New Guinea', dial: '675', flag: '🇵🇬' },
  { code: 'PY', name: 'Paraguay', dial: '595', flag: '🇵🇾' },
  { code: 'PE', name: 'Peru', dial: '51', flag: '🇵🇪' },
  { code: 'PH', name: 'Philippines', dial: '63', flag: '🇵🇭' },
  { code: 'PL', name: 'Poland', dial: '48', flag: '🇵🇱' },
  { code: 'PT', name: 'Portugal', dial: '351', flag: '🇵🇹' },
  { code: 'QA', name: 'Qatar', dial: '974', flag: '🇶🇦' },
  { code: 'RO', name: 'Romania', dial: '40', flag: '🇷🇴' },
  { code: 'RU', name: 'Russia', dial: '7', flag: '🇷🇺' },
  { code: 'RW', name: 'Rwanda', dial: '250', flag: '🇷🇼' },
  { code: 'SA', name: 'Saudi Arabia', dial: '966', flag: '🇸🇦' },
  { code: 'SN', name: 'Senegal', dial: '221', flag: '🇸🇳' },
  { code: 'RS', name: 'Serbia', dial: '381', flag: '🇷🇸' },
  { code: 'SC', name: 'Seychelles', dial: '248', flag: '🇸🇨' },
  { code: 'SK', name: 'Slovakia', dial: '421', flag: '🇸🇰' },
  { code: 'SI', name: 'Slovenia', dial: '386', flag: '🇸🇮' },
  { code: 'ZA', name: 'South Africa', dial: '27', flag: '🇿🇦' },
  { code: 'KR', name: 'South Korea', dial: '82', flag: '🇰🇷' },
  { code: 'ES', name: 'Spain', dial: '34', flag: '🇪🇸' },
  { code: 'SD', name: 'Sudan', dial: '249', flag: '🇸🇩' },
  { code: 'SE', name: 'Sweden', dial: '46', flag: '🇸🇪' },
  { code: 'CH', name: 'Switzerland', dial: '41', flag: '🇨🇭' },
  { code: 'TW', name: 'Taiwan', dial: '886', flag: '🇹🇼' },
  { code: 'TZ', name: 'Tanzania', dial: '255', flag: '🇹🇿' },
  { code: 'TL', name: 'Timor-Leste', dial: '670', flag: '🇹🇱' },
  { code: 'TN', name: 'Tunisia', dial: '216', flag: '🇹🇳' },
  { code: 'TR', name: 'Türkiye', dial: '90', flag: '🇹🇷' },
  { code: 'UG', name: 'Uganda', dial: '256', flag: '🇺🇬' },
  { code: 'UA', name: 'Ukraine', dial: '380', flag: '🇺🇦' },
  { code: 'UY', name: 'Uruguay', dial: '598', flag: '🇺🇾' },
  { code: 'UZ', name: 'Uzbekistan', dial: '998', flag: '🇺🇿' },
  { code: 'VE', name: 'Venezuela', dial: '58', flag: '🇻🇪' },
  { code: 'VN', name: 'Vietnam', dial: '84', flag: '🇻🇳' },
  { code: 'YE', name: 'Yemen', dial: '967', flag: '🇾🇪' },
  { code: 'ZM', name: 'Zambia', dial: '260', flag: '🇿🇲' },
  { code: 'ZW', name: 'Zimbabwe', dial: '263', flag: '🇿🇼' },
]

export const DEFAULT_COUNTRY = 'MM'

export function findCountry(code: string): Country {
  return COUNTRIES.find((c) => c.code === code) ?? COUNTRIES[0]
}

/** Keep only digits. */
function digitsOnly(value: string): string {
  return value.replace(/\D+/g, '')
}

/**
 * Turn a country dial code + whatever the user typed in the national field into E.164.
 * Tolerates the common ways people paste a number:
 *   "+94 77 123 4537" / "0094771234537" / "94771234537" / "0771234537" / "771234537"
 * all become "+94771234537".
 */
export function toE164(dial: string, national: string): string {
  const d = digitsOnly(dial)
  let n = digitsOnly(national)

  // International prefixes pasted into the national field.
  if (n.startsWith('00')) n = n.slice(2)
  // Full number pasted with its country code — don't duplicate the dial code.
  if (d && n.startsWith(d) && n.length > d.length) n = n.slice(d.length)
  // National trunk prefix ("0" in most countries) is dropped in E.164.
  n = n.replace(/^0+/, '')

  return n ? `+${d}${n}` : ''
}

/** Strict E.164: "+" then 8–15 digits, first digit non-zero. */
export function isValidE164(phone: string): boolean {
  return /^\+[1-9][0-9]{7,14}$/.test(phone)
}

/** Pretty grouping for display only — never sent anywhere. */
export function formatE164(phone: string): string {
  if (!phone.startsWith('+')) return phone
  const digits = digitsOnly(phone)
  const country = COUNTRIES.filter((c) => digits.startsWith(c.dial)).sort((a, b) => b.dial.length - a.dial.length)[0]
  if (!country) return phone
  const rest = digits.slice(country.dial.length)
  const groups = rest.replace(/(\d{3})(?=\d)/g, '$1 ')
  return `+${country.dial} ${groups}`.trim()
}

/** Loose email check — the server validates for real; this only gates the button. */
export function looksLikeEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim())
}

/** Split an E.164 number back into a country + national part (longest dial match wins). */
export function splitDefault(phone?: string): { country: string; national: string } {
  if (!phone) return { country: DEFAULT_COUNTRY, national: '' }
  const digits = phone.replace(/\D+/g, '')
  const match = COUNTRIES.filter((c) => digits.startsWith(c.dial)).sort((a, b) => b.dial.length - a.dial.length)[0]
  if (!match) return { country: DEFAULT_COUNTRY, national: digits }
  return { country: match.code, national: digits.slice(match.dial.length) }
}
