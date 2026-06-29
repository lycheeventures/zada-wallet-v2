import { supabase } from '@easypid/services/supabase'
import type { PassportReadResult } from '../../../modules/passport-nfc'
import type { MrzData } from './mrz'

// P4 — turn the chip read into a Passport SD-JWT VC via the hub's hovi-issue-passport edge function,
// returning the openid-credential-offer:// URI for the wallet to claim on the normal receipt rail.

/** YYMMDD (MRZ) → YYYY-MM-DD. `future`=false (birthdate) prefers a past date across the century pivot. */
function yymmddToIso(yymmdd: string, future: boolean): string | undefined {
  if (!/^\d{6}$/.test(yymmdd)) return undefined
  const yy = Number(yymmdd.slice(0, 2))
  const mm = yymmdd.slice(2, 4)
  const dd = yymmdd.slice(4, 6)
  const now = new Date()
  let year = 2000 + yy
  if (future) {
    // Expiry: always in (or near) the future; if 20YY is well in the past, it's 21YY (rare) — keep 20YY.
  } else if (year > now.getFullYear()) {
    // Birthdate: a 20YY in the future must be 19YY.
    year = 1900 + yy
  }
  return `${year}-${mm}-${dd}`
}

function ageOver18(birthIso?: string): boolean {
  if (!birthIso) return false
  const b = new Date(birthIso)
  if (Number.isNaN(b.getTime())) return false
  const eighteen = new Date(b.getFullYear() + 18, b.getMonth(), b.getDate())
  return new Date() >= eighteen
}

/** jMRTD Gender enum name → ISO/IEC 5218 (0 not known, 1 male, 2 female, 9 not applicable). */
function genderToIso5218(g?: string): string {
  switch ((g ?? '').toUpperCase()) {
    case 'MALE':
      return '1'
    case 'FEMALE':
      return '2'
    case 'UNSPECIFIED':
      return '9'
    default:
      return '0'
  }
}

/** Build the credentialValues object the Passport Hovi template expects (strict EUDI-PID claims). */
export function buildPassportCredentialValues(passport: PassportReadResult, mrz: MrzData): Record<string, unknown> {
  const birthdate = yymmddToIso(passport.dateOfBirth, false)
  const given = passport.secondaryIdentifier?.trim()
  const family = passport.primaryIdentifier?.trim()
  const values: Record<string, unknown> = {
    type: 'Passport',
    document_type: passport.documentCode || 'P',
    document_number: passport.documentNumber,
    issuing_country: passport.issuingState,
    family_name: family,
    given_name: given,
    name: [given, family].filter(Boolean).join(' '),
    nationalities: passport.nationality,
    birthdate,
    sex: genderToIso5218(passport.gender),
    expiry_date: yymmddToIso(passport.dateOfExpiry, true),
    personal_administrative_number: passport.personalNumber || undefined,
    mrz: passport.mrz || mrz.rawMrz || undefined,
    age_over_18: ageOver18(birthdate),
    // Provenance: ZADA attests it cryptographically read+verified the chip (MVP: DG-hash integrity).
    chip_authenticated: passport.chipAuthenticated,
  }
  if (passport.faceImageBase64 && passport.faceImageMimeType) {
    values.portrait = `data:${passport.faceImageMimeType};base64,${passport.faceImageBase64}`
  }
  // Drop undefined so we don't send empty claims.
  for (const k of Object.keys(values)) if (values[k] === undefined) delete values[k]
  return values
}

/** Issue the passport credential and return the offer URI (or throw with a message). */
export async function issuePassportCredential(passport: PassportReadResult, mrz: MrzData): Promise<string> {
  const credentialValues = buildPassportCredentialValues(passport, mrz)
  const { data, error } = await supabase.functions.invoke('hovi-issue-passport', { body: { credentialValues } })
  if (error) throw new Error(error.message ?? 'Issuance request failed')
  const uri = (data as { credentialOfferUri?: string })?.credentialOfferUri
  if (!uri) throw new Error((data as { error?: string })?.error ?? 'No credential offer returned')
  return uri
}
