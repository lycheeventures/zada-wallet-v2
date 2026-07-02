/**
 * Anonymous support identity + local read-state, persisted in MMKV.
 *
 * The wallet has no user accounts, so we mint a stable UUID on first use and map
 * it (server-side, in the proxy) to a FreeScout customer `user-<uuid>@wallet.zada.io`.
 * Name/email are OPTIONAL — if the user provides them we pass them along so the team
 * can follow up by email and history survives a reinstall.
 */
import { mmkv } from '@easypid/storage/mmkv'
import * as Crypto from 'expo-crypto'
import type { ConversationSummary } from './supportApi'

const K_USER_ID = 'support.userId'
const K_NAME = 'support.name'
const K_EMAIL = 'support.email'
const K_SEEN = (conversationId: number) => `support.seen.${conversationId}`

/** Stable per-install id; created lazily on first read. */
export function getSupportUserId(): string {
  let id = mmkv.getString(K_USER_ID)
  if (!id) {
    id = Crypto.randomUUID()
    mmkv.set(K_USER_ID, id)
  }
  return id
}

export function getSupportProfile(): { name?: string; email?: string } {
  return { name: mmkv.getString(K_NAME) || undefined, email: mmkv.getString(K_EMAIL) || undefined }
}

export function setSupportProfile(profile: { name?: string; email?: string }): void {
  if (profile.name !== undefined) mmkv.set(K_NAME, profile.name.trim())
  if (profile.email !== undefined) mmkv.set(K_EMAIL, profile.email.trim())
}

export function hasProvidedProfile(): boolean {
  return Boolean(mmkv.getString(K_NAME) || mmkv.getString(K_EMAIL))
}

// --- unread tracking (local, so we never depend on server read-state) -------

/** Call when a conversation is opened/viewed — records the latest message time seen. */
export function markConversationSeen(conversationId: number, lastAt?: string): void {
  if (lastAt) mmkv.set(K_SEEN(conversationId), lastAt)
}

/** Unread when the newest message is from an agent and newer than what we've seen. */
export function isConversationUnread(c: ConversationSummary): boolean {
  if (c.lastRole !== 'agent' || !c.lastAt) return false
  const seen = mmkv.getString(K_SEEN(c.conversationId))
  return !seen || c.lastAt > seen
}
