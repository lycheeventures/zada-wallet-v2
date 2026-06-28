import { type EventSubscription, requireNativeModule } from 'expo-modules-core'

/** The BAC/PACE key inputs derived from the MRZ (P2). Dates are YYMMDD as printed in the MRZ. */
export interface PassportReadRequest {
  documentNumber: string
  dateOfBirth: string
  dateOfExpiry: string
}

/** Result of a successful eMRTD chip read (DG1 + DG2 + passive-auth verdict). */
export interface PassportReadResult {
  documentCode: string
  documentNumber: string
  issuingState: string
  nationality: string
  primaryIdentifier: string
  secondaryIdentifier: string
  dateOfBirth: string
  dateOfExpiry: string
  gender: string
  personalNumber?: string
  mrz: string
  faceImageBase64?: string
  faceImageMimeType?: string
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

// LAZY + GUARDED: never call requireNativeModule at import time. If the native module isn't in the
// build (e.g. autolinking missed the local module), importing this file must NOT throw — otherwise
// it takes down the whole passport flow (incl. the MRZ camera step) before it can render.
let _mod: PassportNfcNativeModule | null = null
let _loadFailed = false
function getModule(): PassportNfcNativeModule | null {
  if (_mod) return _mod
  if (_loadFailed) return null
  try {
    _mod = requireNativeModule<PassportNfcNativeModule>('PassportNfc')
    return _mod
  } catch {
    _loadFailed = true
    return null
  }
}

/** Whether the native passport-reader module is present in this build (false ⇒ autolinking missed it). */
export function isPassportReaderAvailable(): boolean {
  return getModule() !== null
}

export async function isNfcAvailable(): Promise<boolean> {
  const m = getModule()
  if (!m) return false
  try {
    return await m.isNfcAvailable()
  } catch {
    return false
  }
}

/**
 * Read the passport chip. Rejects with READER_UNAVAILABLE if the native module isn't in the build,
 * NFC_UNAVAILABLE / NO_ACTIVITY / TAG_LOST / AUTH_FAILED / PASSPORT_READ_ERROR otherwise.
 */
export async function readPassport(req: PassportReadRequest): Promise<PassportReadResult> {
  const m = getModule()
  if (!m) throw new Error('READER_UNAVAILABLE')
  return m.readPassport(req.documentNumber, req.dateOfBirth, req.dateOfExpiry)
}

export async function cancelPassportRead(): Promise<void> {
  const m = getModule()
  if (m) {
    try {
      await m.cancel()
    } catch {}
  }
}

export function addPassportStatusListener(listener: (status: PassportNfcStatus) => void): EventSubscription {
  const m = getModule()
  if (!m) return { remove() {} } as EventSubscription
  return m.addListener('onStatus', ({ status }) => listener(status))
}
