// MRZ (Machine Readable Zone) OCR + parsing for the passport import flow (P2).
//
// Why: the eMRTD chip's BAC/PACE access key is derived from three printed MRZ fields —
// document number, date of birth, and date of expiry (each with its check digit). So before we can
// talk to the chip (P3) we must OCR the MRZ off the passport's data page and parse it.
//
// On-device, offline OCR via ML Kit text recognition (no PII leaves the device); check-digit
// validation via the `mrz` package. TD3 (passport) layout = two 44-character lines.

import TextRecognition from '@react-native-ml-kit/text-recognition'
import { parse } from 'mrz'

/** The parsed MRZ. documentNumber/dateOfBirth/dateOfExpiry are the BAC/PACE key inputs P3 needs. */
export interface MrzData {
  /** BAC/PACE key inputs */
  documentNumber: string
  dateOfBirth: string // YYMMDD, as printed in the MRZ
  dateOfExpiry: string // YYMMDD, as printed in the MRZ
  /** Extra fields, used to prefill credential claims after the chip read */
  documentCode?: string // e.g. "P"
  issuingState?: string // ISO 3166-1 alpha-3
  nationality?: string // ISO 3166-1 alpha-3
  firstName?: string
  lastName?: string
  sex?: 'male' | 'female' | 'nonspecified' | 'unspecified' | string
  personalNumber?: string
  /** The raw two MRZ lines, joined with a newline (also carried into the credential `mrz` claim). */
  rawMrz: string
  /** Whether all MRZ check digits validated. False ⇒ OCR is likely imperfect; offer manual entry. */
  valid: boolean
}

// Pull the most likely TD3 MRZ lines out of arbitrary OCR text. MRZ chars are [A-Z0-9<]; the data
// page has other text too, so we keep only lines that look like MRZ and take the last two long ones.
export function extractMrzLines(text: string): string[] | null {
  const candidates = text
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, '').toUpperCase())
    .filter((l) => l.length >= 28 && l.includes('<') && /^[A-Z0-9<]+$/.test(l))

  // TD3 passport = two 44-char lines. Be lenient about OCR length drift, then pad/trim to 44.
  const longLines = candidates.filter((l) => l.length >= 40)
  if (longLines.length < 2) return null
  return longLines.slice(-2).map((l) => l.padEnd(44, '<').slice(0, 44))
}

/** Parse already-extracted MRZ lines. Returns null on unparseable input. */
export function parseMrzLines(lines: string[]): MrzData | null {
  let result: ReturnType<typeof parse>
  try {
    result = parse(lines)
  } catch {
    return null
  }
  const f = result.fields
  // The three BAC inputs are mandatory; without them we can't unlock the chip.
  if (!f.documentNumber || !f.birthDate || !f.expirationDate) return null
  return {
    documentNumber: f.documentNumber,
    dateOfBirth: f.birthDate,
    dateOfExpiry: f.expirationDate,
    documentCode: f.documentCode ?? undefined,
    issuingState: f.issuingState ?? undefined,
    nationality: f.nationality ?? undefined,
    firstName: f.firstName ?? undefined,
    lastName: f.lastName ?? undefined,
    sex: f.sex ?? undefined,
    personalNumber: f.personalNumber ?? undefined,
    rawMrz: lines.join('\n'),
    valid: result.valid,
  }
}

/** OCR an image of the passport data page and parse its MRZ. Returns null if no MRZ was found. */
export async function ocrMrzFromImage(imageUri: string): Promise<MrzData | null> {
  const { text } = await TextRecognition.recognize(imageUri)
  const lines = extractMrzLines(text)
  if (!lines) return null
  return parseMrzLines(lines)
}
