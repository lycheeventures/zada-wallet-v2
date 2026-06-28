import { type EventSubscription, requireNativeModule } from 'expo-modules-core'

/** The BAC/PACE key inputs derived from the MRZ (P2). Dates are YYMMDD as printed in the MRZ. */
export interface PassportReadRequest {
  documentNumber: string
  dateOfBirth: string
  dateOfExpiry: string
}

/** Result of a successful eMRTD chip read (DG1 + DG2 + passive-auth verdict). */
export interface PassportReadResult {
  // DG1 (MRZ data groups)
  documentCode: string
  documentNumber: string
  issuingState: string // ISO 3166-1 alpha-3
  nationality: string // ISO 3166-1 alpha-3
  primaryIdentifier: string // surname
  secondaryIdentifier: string // given names
  dateOfBirth: string // YYMMDD
  dateOfExpiry: string // YYMMDD
  gender: string // 'MALE' | 'FEMALE' | 'UNSPECIFIED' | 'UNKNOWN' (jMRTD Gender enum name)
  personalNumber?: string
  mrz: string // the raw MRZ as stored in DG1
  // DG2 (portrait)
  faceImageBase64?: string // base64 of the encoded face image
  faceImageMimeType?: string // 'image/jpeg' or 'image/jp2'
  // Passive authentication (MVP: DG-hash integrity + SOD/DSC signature; NOT CSCA-anchored yet)
  chipAuthenticated: boolean
  passiveAuthDetail?: string
}

export type PassportNfcStatus =
  | 'waiting_for_tag'
  | 'tag_detected'
  | 'authenticating'
  | 'reading_dg1'
  | 'reading_dg2'
  | 'verifying'
  | 'done'

interface PassportNfcNativeModule {
  isNfcAvailable(): Promise<boolean>
  readPassport(documentNumber: string, dateOfBirth: string, dateOfExpiry: string): Promise<PassportReadResult>
  cancel(): Promise<void>
  addListener(event: 'onStatus', listener: (payload: { status: PassportNfcStatus }) => void): EventSubscription
}

const PassportNfc = requireNativeModule<PassportNfcNativeModule>('PassportNfc')

export async function isNfcAvailable(): Promise<boolean> {
  return PassportNfc.isNfcAvailable()
}

/**
 * Read the passport chip. Enables NFC reader mode; resolves once the user holds the passport to the
 * phone and DG1/DG2 are read + passive-auth checked. Reject reasons: NFC_UNAVAILABLE, NO_ACTIVITY,
 * TAG_LOST, AUTH_FAILED (wrong MRZ key), PASSPORT_READ_ERROR.
 */
export async function readPassport(req: PassportReadRequest): Promise<PassportReadResult> {
  return PassportNfc.readPassport(req.documentNumber, req.dateOfBirth, req.dateOfExpiry)
}

/** Cancel an in-flight read (disables reader mode). */
export async function cancelPassportRead(): Promise<void> {
  return PassportNfc.cancel()
}

export function addPassportStatusListener(listener: (status: PassportNfcStatus) => void): EventSubscription {
  return PassportNfc.addListener('onStatus', ({ status }) => listener(status))
}
