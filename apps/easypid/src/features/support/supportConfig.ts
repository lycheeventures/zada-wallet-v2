/**
 * Config for the in-app support chat (talks to the wallet-support-proxy, never
 * directly to FreeScout). The app key is intentionally low-value — the real
 * FreeScout API key lives only on the proxy (server-side).
 *
 * Set these in the app env (e.g. .env / eas.json):
 *   EXPO_PUBLIC_SUPPORT_API_URL=https://support.zada.solutions/wallet-api
 *   EXPO_PUBLIC_SUPPORT_APP_KEY=<the X-Wallet-Key>
 */
export const SUPPORT_API_URL = process.env.EXPO_PUBLIC_SUPPORT_API_URL ?? 'https://support.zada.solutions/wallet-api'

export const SUPPORT_APP_KEY = process.env.EXPO_PUBLIC_SUPPORT_APP_KEY ?? ''

/** Poll interval while a chat / list is on screen. */
export const SUPPORT_POLL_INTERVAL_MS = 4000
