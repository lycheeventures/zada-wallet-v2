import { mmkv } from '../../storage/mmkv'
import type { BlockedCredential, ClaimableCredential } from './usherApi'

/**
 * The ZADA ID flow's resumable state.
 *
 * Why it is persisted at all: reading an SMS or WhatsApp code usually means leaving the app, and
 * the wallet locks after a minute in the background. Unlocking re-mounts this flow from scratch
 * (`redirectAfterUnlock` brings the route back, not the component state), so without this the
 * user would be sent back to "enter your phone" right after typing the code. The web flow keeps
 * the same session in localStorage for the same reason.
 *
 * What it holds: the verified contacts, the short-lived (15 min) session tokens from the usher, and
 * the discovered credential list. The tokens embed the holder's own phone/email and credential
 * attributes, so this is PII — it lives only for the flow (`TTL_MS`), is cleared on finish or
 * cancel, and never leaves the device.
 */

const KEY = 'zadaIdFlowState.v1'
// The usher's session tokens expire after 15 minutes; keep the local copy a little shorter so a
// resumed flow never presents a token that is already dead.
const TTL_MS = 14 * 60 * 1000

export type FlowStep = 'phone' | 'phoneCode' | 'email' | 'emailCode' | 'name' | 'review'

export interface DiscoveredCredential extends ClaimableCredential {
  /** The session token that carries this credential — claims must present the matching one. */
  token: string
}

export interface ZadaIdFlowState {
  step: FlowStep
  /** E.164, once the phone step has been submitted. */
  phone?: string
  maskedPhone?: string
  phoneToken?: string
  email?: string
  emailToken?: string
  name?: string
  credentials: DiscoveredCredential[]
  blocked: BlockedCredential[]
  /** Which discovered credentials the user has deselected (opt-out; default is all selected). */
  deselected: string[]
  phoneDiscovered: boolean
  emailDiscovered: boolean
  expiresAt: number
}

export const emptyFlowState = (): ZadaIdFlowState => ({
  step: 'phone',
  credentials: [],
  blocked: [],
  deselected: [],
  phoneDiscovered: false,
  emailDiscovered: false,
  expiresAt: Date.now() + TTL_MS,
})

export function loadFlowState(): ZadaIdFlowState | undefined {
  try {
    const raw = mmkv.getString(KEY)
    if (!raw) return undefined
    const parsed = JSON.parse(raw) as ZadaIdFlowState
    if (!parsed || typeof parsed !== 'object' || !parsed.step || parsed.expiresAt < Date.now()) {
      clearFlowState()
      return undefined
    }
    return parsed
  } catch {
    clearFlowState()
    return undefined
  }
}

export function saveFlowState(state: ZadaIdFlowState) {
  mmkv.set(KEY, JSON.stringify(state))
}

export function clearFlowState() {
  mmkv.remove(KEY)
}
