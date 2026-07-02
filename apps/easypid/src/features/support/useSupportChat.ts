/**
 * React-Query hooks for the support chat: list conversations, poll a thread,
 * and send a message (starting a new conversation when no id is given).
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchGuides, getMessages, listConversations, sendMessage } from './supportApi'
import { SUPPORT_POLL_INTERVAL_MS } from './supportConfig'
import { getDeviceDiagnostics } from './supportDevice'
import { getSupportProfile, getSupportUserId } from './supportIdentity'

const keys = {
  conversations: (userId: string) => ['support', 'conversations', userId] as const,
  messages: (conversationId?: number) => ['support', 'messages', conversationId] as const,
}

export function useConversations() {
  const userId = getSupportUserId()
  return useQuery({
    queryKey: keys.conversations(userId),
    queryFn: () => listConversations(userId),
    refetchInterval: SUPPORT_POLL_INTERVAL_MS,
  })
}

/** Help guides from the support knowledge base. Rarely change, so cache generously. */
export function useGuides() {
  return useQuery({
    queryKey: ['support', 'guides'] as const,
    queryFn: fetchGuides,
    staleTime: 1000 * 60 * 60,
  })
}

export function useMessages(conversationId?: number) {
  const userId = getSupportUserId()
  return useQuery({
    queryKey: keys.messages(conversationId),
    queryFn: () => getMessages(userId, conversationId as number),
    enabled: typeof conversationId === 'number',
    refetchInterval: SUPPORT_POLL_INTERVAL_MS,
  })
}

/**
 * Send a message. Omit conversationId to start a NEW conversation (device
 * diagnostics are attached automatically on the first message of a new one).
 */
export function useSendMessage() {
  const userId = getSupportUserId()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (vars: { text: string; conversationId?: number }) => {
      const profile = getSupportProfile()
      const isNew = typeof vars.conversationId !== 'number'
      return sendMessage({
        userId,
        text: vars.text,
        conversationId: vars.conversationId,
        name: profile.name,
        email: profile.email,
        device: isNew ? getDeviceDiagnostics() : undefined,
      })
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: keys.messages(data.conversationId) })
      queryClient.invalidateQueries({ queryKey: keys.conversations(userId) })
    },
  })
}
