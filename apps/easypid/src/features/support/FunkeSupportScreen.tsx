import { TextBackButton } from '@package/app'
import {
  AnimatedStack,
  Button,
  FlexPage,
  HeaderContainer,
  Heading,
  HeroIcons,
  Loader,
  Paragraph,
  ScrollView,
  Stack,
  useScaleAnimation,
  XStack,
  YStack,
} from '@package/ui'
import { router } from 'expo-router'
import type { ConversationSummary } from './supportApi'
import { isConversationUnread } from './supportIdentity'
import { useConversations } from './useSupportChat'

function ConversationRow({ conversation, onPress }: { conversation: ConversationSummary; onPress: () => void }) {
  const { pressStyle, handlePressIn, handlePressOut } = useScaleAnimation()
  const unread = isConversationUnread(conversation)

  return (
    <AnimatedStack
      style={pressStyle}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={onPress}
      flexDirection="column"
      br="$4"
      bg="$grey-50"
      p="$4"
      gap="$1"
    >
      <XStack ai="center" jc="space-between" gap="$2">
        <Paragraph flex={1} numberOfLines={1} color="$grey-900" fontWeight={unread ? '$bold' : '$semiBold'}>
          {conversation.subject || 'Wallet support'}
        </Paragraph>
        {unread ? (
          <Stack width={10} height={10} br={9999} bg="$primary-500" />
        ) : (
          <HeroIcons.ChevronRight color="$grey-500" />
        )}
      </XStack>
      <Paragraph numberOfLines={1} variant="sub" color="$grey-600" fontWeight={unread ? '$semiBold' : '$regular'}>
        {conversation.lastRole === 'user' ? 'You: ' : ''}
        {conversation.lastText || 'No messages yet'}
      </Paragraph>
    </AnimatedStack>
  )
}

export function FunkeSupportScreen() {
  const { data: conversations, isLoading } = useConversations()
  const hasConversations = !!conversations && conversations.length > 0

  return (
    <FlexPage gap="$0" paddingHorizontal="$0">
      <ScrollView flex={1} bg="$background" safeAreaBottom={20}>
        <HeaderContainer title="Help & Support" />
        <TextBackButton />
        <YStack fg={1} px="$4" gap="$4" pt="$2">
          <YStack gap="$2">
            <Heading heading="h2">Start a conversation</Heading>
            <Paragraph color="$grey-700">
              Ask us anything about your wallet. Our team will get back to you, usually within a day.
            </Paragraph>
            <Button.Solid onPress={() => router.push('/support/new')}>New conversation</Button.Solid>
          </YStack>

          {/* Guides — stubbed for v1 (will be powered by the support knowledge base later). */}
          <XStack ai="center" jc="space-between" br="$4" bg="$grey-50" p="$4" opacity={0.6}>
            <XStack ai="center" gap="$3">
              <HeroIcons.QuestionMarkCircle color="$grey-500" />
              <Paragraph color="$grey-700" fontWeight="$semiBold">
                Help guides
              </Paragraph>
            </XStack>
            <Paragraph variant="sub" color="$grey-500">
              Coming soon
            </Paragraph>
          </XStack>

          {hasConversations && (
            <YStack gap="$2">
              <Heading heading="h3" color="$grey-700">
                Previous conversations
              </Heading>
              {conversations.map((conversation) => (
                <ConversationRow
                  key={conversation.conversationId}
                  conversation={conversation}
                  onPress={() => router.push(`/support/${conversation.conversationId}`)}
                />
              ))}
            </YStack>
          )}

          {isLoading && !hasConversations && (
            <Stack ai="center" py="$4">
              <Loader />
            </Stack>
          )}
        </YStack>
      </ScrollView>
    </FlexPage>
  )
}
