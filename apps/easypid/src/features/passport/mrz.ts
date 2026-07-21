// MRZ (Machine Readable Zone) data for the passport import flow.
//
// The eMRTD chip's BAC/PACE access key is derived from three printed MRZ fields — document number,
// date of birth, and date of expiry (each with its check digit). The user enters these in
// `PassportScanScreen` (P2); the chip read (P3) then fills in the remaining fields from DG1.

/** The passport MRZ data. documentNumber/dateOfBirth/dateOfExpiry are the BAC/PACE key inputs P3 needs. */
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
  /** Whether all MRZ check digits validated. Manual entry sets this false; the chip read is authoritative. */
  valid: boolean
}
