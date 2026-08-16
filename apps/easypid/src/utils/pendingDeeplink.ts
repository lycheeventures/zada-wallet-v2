import { logger } from '@package/agent'

/**
 * Belt-and-braces store for the deep-link target route ("/notifications/credentialBatch?batch=…",
 * "/notifications/openIdCredential?uri=…").
 *
 * The primary delivery path is expo-router: +native-intent returns
 * `/authenticate?redirectAfterUnlock=<target>` and the authenticate screen redirects to the target
 * after PIN entry. On Android that dance is racy: the deep link, the AppState `active` transition,
 * the >60s background lock and the (app) layout's own locked-redirect all land in the same beat,
 * and depending on which wins the `redirectAfterUnlock` param can be dropped — the user unlocks
 * and lands on the dashboard with the batch import silently lost (observed on device; the exact
 * interleaving is timing-dependent and not reliably reproducible).
 *
 * So the native-intent handler ALSO records the target here. Consumers:
 *  - authenticate.tsx falls back to `peekPendingDeeplink()` when it unlocks without a
 *    `redirectAfterUnlock` param,
 *  - the home screen subscribes via `onPendingDeeplink` and navigates if a deep link arrives
 *    while the wallet is already unlocked on the dashboard and no navigation happened at all,
 *  - the (app) layout calls `clearPendingDeeplink(pathname)` when the target route actually
 *    mounts, which ends the deep link's lifecycle in every successful path.
 *
 * Module state only — dies with the JS process, which is exactly the lifetime a pending
 * navigation should have. The TTL guards against a stale target resurfacing much later in a
 * long-lived process.
 */

const PENDING_DEEPLINK_TTL_MS = 5 * 60_000

let pending: { path: string; setAt: number } | null = null
const listeners = new Set<(path: string) => void>()

export function setPendingDeeplink(path: string) {
  pending = { path, setAt: Date.now() }
  logger.debug('Recorded pending deeplink target', { path })
  for (const listener of listeners) listener(path)
}

/** Returns the pending target if one exists and is fresh; does not clear it. */
export function peekPendingDeeplink(): string | null {
  if (!pending) return null
  if (Date.now() - pending.setAt > PENDING_DEEPLINK_TTL_MS) {
    pending = null
    return null
  }
  return pending.path
}

/**
 * Clears the pending target. With `mountedPathname`, only clears when it matches the target's
 * path (query stripped) — used by the (app) layout to end the lifecycle when the target mounts.
 */
export function clearPendingDeeplink(mountedPathname?: string) {
  if (!pending) return
  if (mountedPathname === undefined || pending.path.split('?')[0] === mountedPathname) {
    logger.debug('Cleared pending deeplink target', { path: pending.path, mountedPathname })
    pending = null
  }
}

/** Subscribe to new pending targets. Returns an unsubscribe function. */
export function onPendingDeeplink(listener: (path: string) => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
