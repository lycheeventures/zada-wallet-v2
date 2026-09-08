import { credentialMigrationUrl } from '@easypid/constants'

/**
 * Client for credential-key-usher's versioned HTTP API (`/api/v1/*`), the backend of the ZADA ID
 * setup / credential migration flow. The web flow at migrate.zada.solutions and these native
 * screens call the SAME server functions — the API is a thin, stable path onto them — so
 * validation, OTP rate limits and error copy are identical on both.
 *
 * Reached directly: migrate.zada.solutions is served from Lovable's dedicated IP
 * (185.158.133.1), which is reachable from Myanmar — unlike *.supabase.co, which is why the batch
 * lookup in MigrateBatchScreen goes through api.zada.solutions and this does not.
 *
 * Errors: the server answers `{ error: { code, message } }` with a user-safe message we can show
 * verbatim (`UsherApiError`). A transport failure (offline, blocked, DNS) is a different thing —
 * `UsherUnreachableError` — because the right recovery differs: retry / fall back to the browser,
 * not "check your code".
 */

export class UsherApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number
  ) {
    super(message)
    this.name = 'UsherApiError'
  }
}

export class UsherUnreachableError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'UsherUnreachableError'
  }
}

export type OtpChannel = 'sms' | 'whatsapp'

export interface ClaimableCredential {
  id: string
  legacy_schema_id: string
  schema_name: string
  hovi_organisation_id: string | null
  tenant_db: string
  display_name: string
  summary: string
  attributes: Record<string, string | number | boolean | null>
}

export interface BlockedCredential {
  tenant_db: string
  legacy_schema_id: string
  name: string | null
}

export interface DiscoverResult {
  /** Fresh session token carrying the discovered credentials — use THIS for claims. */
  token: string
  credentials: ClaimableCredential[]
  pendingIssuerSetup: number
  blocked: BlockedCredential[]
  bridgedPhones?: number
  devNote?: string
}

export interface SendOtpResult {
  ok: boolean
  channel?: OtpChannel
  provider?: string
  /** Only present when the provider runs in demo mode (no real send). */
  devCode?: string
  devNote?: string
}

const DEFAULT_TIMEOUT_MS = 20_000
// Discovery fans out across the legacy tenant databases (6 s per tenant server-side).
const DISCOVER_TIMEOUT_MS = 60_000

function baseUrl(): string {
  if (!credentialMigrationUrl) {
    throw new UsherApiError('not_configured', 'ZADA ID setup is not available in this build.', 0)
  }
  return `${credentialMigrationUrl.replace(/\/+$/, '')}/api/v1`
}

async function post<T>(path: string, body: Record<string, unknown>, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<T> {
  const url = `${baseUrl()}/${path}`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  let res: Response
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
  } catch (error) {
    const reason = error instanceof Error && error.name === 'AbortError' ? 'timed out' : 'network error'
    throw new UsherUnreachableError(`Could not reach ZADA (${reason}).`)
  } finally {
    clearTimeout(timer)
  }

  const text = await res.text()
  let json: unknown = {}
  if (text) {
    try {
      json = JSON.parse(text)
    } catch {
      throw new UsherApiError('invalid_response', `Unexpected response from ZADA (${res.status}).`, res.status)
    }
  }
  if (!res.ok) {
    const err = (json as { error?: { code?: string; message?: string } }).error
    throw new UsherApiError(
      err?.code ?? 'request_failed',
      err?.message ?? `Request failed (${res.status}).`,
      res.status
    )
  }
  return json as T
}

export const usherApi = {
  sendOtp: (phone: string, channel: OtpChannel) => post<SendOtpResult>('otp/send', { phone, channel }),
  verifyOtp: (phone: string, code: string) =>
    post<{ token: string; maskedPhone: string }>('otp/verify', { phone, code }),
  sendEmailOtp: (email: string) => post<SendOtpResult>('email/send', { email }),
  verifyEmailOtp: (email: string, code: string) => post<{ token: string }>('email/verify', { email, code }),
  discoverPhone: (token: string) => post<DiscoverResult>('discover/phone', { token }, DISCOVER_TIMEOUT_MS),
  discoverEmail: (token: string) => post<DiscoverResult>('discover/email', { token }, DISCOVER_TIMEOUT_MS),
  /** One credential per call — the platform's "user-initiated, per-credential" rule. */
  claimCredential: (token: string, credentialId: string) =>
    post<{ offerUrl: string }>('credentials/claim', { token, credentialId }),
  claimZadaId: (phoneToken: string, emailToken: string, name: string) =>
    post<{ offerUrl: string; devNote?: string }>('zada-id/claim', { phoneToken, emailToken, name }),
  notifyWhenReady: (token: string) => post<{ ok: boolean; registered: number }>('notify-when-ready', { token }),
}
