import { TextBackButton } from '@package/app'
import {
  AnimatedStack,
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
import { useState } from 'react'
import type { GuideSection } from './supportApi'
import { useGuides } from './useSupportChat'

// The guide bodies are light markdown; strip the syntax the app can't style so the
// text reads cleanly. Line breaks and bullet/number prefixes are kept as-is.
function cleanBody(body: string) {
  return body
    .replace(/\*\*/g, '')
    .replace(/^#+\s*/gm, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .trim()
}

function SectionRow({ section }: { section: GuideSection }) {
  const [open, setOpen] = useState(false)
  const { pressStyle, handlePressIn, handlePressOut } = useScaleAnimation()

  return (
    <YStack br="$4" bg="$grey-50" px="$4" py="$3" gap="$2">
      <AnimatedStack
        style={pressStyle}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={() => setOpen((o) => !o)}
        flexDirection="row"
        ai="center"
        jc="space-between"
        gap="$3"
      >
        <Paragraph flex={1} fontWeight="$semiBold" color="$grey-900">
          {section.heading}
        </Paragraph>
        {open ? <HeroIcons.ChevronUp color="$grey-500" /> : <HeroIcons.ChevronDown color="$grey-500" />}
      </AnimatedStack>
      {open && <Paragraph color="$grey-700">{cleanBody(section.body)}</Paragraph>}
    </YStack>
  )
}

export function FunkeGuidesScreen() {
  const { data: guides, isLoading } = useGuides()
  const isEmpty = !isLoading && (!guides || guides.length === 0)

  return (
    <FlexPage gap="$0" paddingHorizontal="$0">
      <ScrollView flex={1} bg="$background" safeAreaBottom={20}>
        <HeaderContainer title="Guides" />
        <TextBackButton />
        <YStack fg={1} px="$4" gap="$4" pt="$2">
          <Paragraph color="$grey-700">Step-by-step help for using your wallet. Tap a topic to expand it.</Paragraph>

          {isLoading && (
            <Stack ai="center" py="$4">
              <Loader />
            </Stack>
          )}

          {guides?.map((guide) => (
            <YStack key={guide.id} gap="$2">
              <Heading heading="h3" color="$grey-700">
                {guide.title}
              </Heading>
              {guide.sections.map((section, i) => (
                <SectionRow key={`${guide.id}-${i}`} section={section} />
              ))}
            </YStack>
          ))}

          {isEmpty && (
            <XStack ai="center" gap="$2" py="$4">
              <HeroIcons.QuestionMarkCircle color="$grey-500" />
              <Paragraph color="$grey-600">
                Guides aren't available right now. Start a conversation and we'll help.
              </Paragraph>
            </XStack>
          )}
        </YStack>
      </ScrollView>
    </FlexPage>
  )
}
