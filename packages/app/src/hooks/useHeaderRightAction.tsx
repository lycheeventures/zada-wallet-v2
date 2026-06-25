import { IconContainer, type IconContainerProps } from '@package/ui'
import { useNavigation } from 'expo-router'
import { useEffect } from 'react'
import { Pressable } from 'react-native-gesture-handler'

interface HeaderAction {
  icon: IconContainerProps['icon']
  onPress: () => void
  renderCondition?: boolean
}

interface UseHeaderRightActionProps {
  actions: HeaderAction[]
}

export function useHeaderRightAction({ actions }: UseHeaderRightActionProps) {
  const navigation = useNavigation()

  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <>
          {actions.map((action, index) =>
            action.renderCondition === false ? null : (
              <Pressable
                key={index}
                onPress={action.onPress}
                style={{ padding: 6 }}
              >
                <IconContainer icon={action.icon} />
              </Pressable>
            )
          )}
        </>
      ),
    })
  }, [navigation, actions])
}
