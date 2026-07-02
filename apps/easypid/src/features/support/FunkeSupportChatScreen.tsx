import { TextBackButton } from '@package/app'
import {
  Button,
  FlexPage,
  HeaderContainer,
  Input,
  Paragraph,
  ScrollView,
  type ScrollViewRefType,
  Stack,
  XStack,
  YStack,
} from '@package/ui'
import { useLocalSearchParams } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import { KeyboardAvoidingView, Platform } from 'react-native'
import type { ChatMessage } from './supportApi'
import { markConversationSeen } from './supportIdentity'
import { useMessages, useSendMessage } from './useSupportChat'

function Bubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user'
  return (
    <XStack jc={isUser ? 'flex-end' : 'flex-start'} px="$4" py="$1">
      <Stack maxWidth="82%" br="$4" px="$3" py="$2" bg={isUser ? '$primary-500' : '$grey-100'}>
        <Paragraph color={isUser ? '$white' : '$grey-900'}>{message.text}</Paragraph>
      </Stack>
    </XStack>
  )
}

export function FunkeSupportChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const initialId = id && id !== 'new' ? Number(id) : undefined

  const [conversationId, setConversationId] = useState<number | undefined>(initialId)
  const [text, setText] = useState('')
  const scrollRef = useRef<ScrollViewRefType>(null)

  const { data, isLoading } = useMessages(conversationId)
  const send = useSendMessage()
  const messages = data?.messages ?? []

  // Mark the conversation as read whenever we see its latest message.
  useEffect(() => {
    const last = messages[messages.length - 1]
    if (conversationId && last) markConversationSeen(conversationId, last.at)
  }, [conversationId, messages])

  const onSend = async () => {
    const trimmed = text.trim()
    if (!trimmed || send.isPending) return
    setText('')
    try {
      const result = await send.mutateAsync({ text: trimmed, conversationId })
      if (!conversationId) setConversationId(result.conversationId)
    } catch {
      setText(trimmed) // restore on failure so the user doesn't lose their message
    }
  }

  return (
    <FlexPage gap="$0" paddingHorizontal="$0">
      <HeaderContainer title="Support" />
      <TextBackButton />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          ref={scrollRef}
          flex={1}
          bg="$background"
          onContentSizeChange={() => scrollRef.current?.scrollToEnd?.({ animated: true })}
        >
          <YStack py="$3" gap="$1">
            {messages.length === 0 && !isLoading && (
              <Paragraph ta="center" color="$grey-500" px="$4" py="$6">
                Send a message and our team will get back to you here.
              </Paragraph>
            )}
            {messages.map((message) => (
              <Bubble key={message.id} message={message} />
            ))}
            {send.isPending && (
              <Paragraph px="$4" variant="sub" color="$grey-500">
                Sending…
              </Paragraph>
            )}
          </YStack>
        </ScrollView>

        <XStack ai="center" gap="$2" px="$4" py="$3" bg="$background" btw={1} boc="$grey-100">
          <Stack flex={1}>
            <Input
              value={text}
              onChangeText={setText}
              placeholder="Message…"
              onSubmitEditing={onSend}
              returnKeyType="send"
            />
          </Stack>
          <Button.Solid disabled={!text.trim() || send.isPending} onPress={onSend}>
            Send
          </Button.Solid>
        </XStack>
      </KeyboardAvoidingView>
    </FlexPage>
  )
}
