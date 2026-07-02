/**
 * Thin client for the wallet-support-proxy. See docs/wallet-support-chat.md in the
 * openclaw-do repo for the full contract.
 */
import { SUPPORT_API_URL, SUPPORT_APP_KEY } from './supportConfig'
import type { DeviceDiagnostics } from './supportDevice'

export type ChatRole = 'user' | 'agent'

export type ChatMessage = {
  id: number
  role: ChatRole
  text: string
  at: string
}

export type ConversationSummary = {
  conversationId: number
  status: string
  subject: string
  lastText: string
  lastRole: ChatRole | ''
  lastAt: string
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${SUPPORT_API_URL}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', 'X-Wallet-Key': SUPPORT_APP_KEY },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) throw new Error(`support proxy error ${res.status}`)
  return (await res.json()) as T
}

export async function listConversations(userId: string): Promise<ConversationSummary[]> {
  const data = await request<{ conversations: ConversationSummary[] }>(
    'GET',
    `/conversations?userId=${encodeURIComponent(userId)}`
  )
  return data.conversations
}

export async function getMessages(
  userId: string,
  conversationId: number
): Promise<{ conversationId: number; status: string; messages: ChatMessage[] }> {
  return request('GET', `/messages?userId=${encodeURIComponent(userId)}&conversationId=${conversationId}`)
}

export async function sendMessage(params: {
  userId: string
  text: string
  conversationId?: number
  name?: string
  email?: string
  device?: DeviceDiagnostics
}): Promise<{ conversationId: number; newConversation: boolean }> {
  return request('POST', '/message', params)
}
