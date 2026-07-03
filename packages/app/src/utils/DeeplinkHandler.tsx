import { InvitationQrTypes } from '@package/agent'
import { useToastController } from '@package/ui'
import { CommonActions } from '@react-navigation/native'
import * as Linking from 'expo-linking'
import { router, useNavigation } from 'expo-router'
import type { ReactNode } from 'react'
import { useCallback, useEffect, useState } from 'react'
import { type CredentialDataHandlerOptions, useCredentialDataHandler } from '../hooks'

interface DeeplinkHandlerProps {
  children: ReactNode
  credentialDataHandlerOptions?: CredentialDataHandlerOptions
}

export const deeplinkSchemes = Object.values(InvitationQrTypes)

// TODO: use https://docs.expo.dev/router/advanced/native-intent/
export const DeeplinkHandler = ({ children, credentialDataHandlerOptions }: DeeplinkHandlerProps) => {
  const { handleCredentialData } = useCredentialDataHandler()
  const toast = useToastController()
  const navigation = useNavigation()

  // TODO: I'm not sure if we need this? Or whether an useEffect without any deps is enough?
  const [hasHandledInitialUrl, setHasHandledInitialUrl] = useState(false)

  const handleUrl = useCallback(
    (url: string) => {
      // Batch credential import from the migration web flow. It uses the app scheme with a
      // dedicated path (…/wallet/credential-offer-batch?offers=[...]) rather than a credential
      // invitation scheme, so it isn't a "recognized" deeplink below — route it to the batch
      // screen explicitly instead of falling through to the reset-to-home path.
      if (url.includes('/wallet/credential-offer-batch')) {
        try {
          const offers = new URL(url).searchParams.get('offers')
          if (offers) {
            navigation.dispatch(CommonActions.reset({ routes: [{ key: 'index', name: 'index' }] }))
            router.push({ pathname: '/notifications/credentialBatch', params: { offers } })
            return
          }
        } catch {
          // fall through to default handling
        }
      }

      const isRecognizedDeeplink = deeplinkSchemes.some((scheme) => url.startsWith(scheme))

      // Whenever a deeplink comes in, we reset the state. This is due to expo
      // routing us always and we can't intercept that. It seems they are working on
      // more control, but for now this is the cleanest approach
      navigation.dispatch(
        CommonActions.reset({
          routes: [{ key: 'index', name: 'index' }],
        })
      )

      // Ignore deeplinks that don't start with the schemes for credentials
      if (isRecognizedDeeplink) {
        void handleCredentialData(url, credentialDataHandlerOptions).then((result) => {
          if (!result.success) {
            toast.show(result.message, { customData: { preset: 'danger' } })
          }
        })
      }
    },
    [navigation.dispatch, toast.show, handleCredentialData, credentialDataHandlerOptions]
  )

  // NOTE: we use getInitialURL and the event listener over useURL as we don't know
  // using that method whether the same url is opened multiple times. As we need to make
  // sure to handle ALL incoming deeplinks (to prevent default expo-router behaviour) we
  // handle them ourselves. On startup getInitialUrl will be called once.
  useEffect(() => {
    if (hasHandledInitialUrl) return
    void Linking.getInitialURL().then((url) => {
      if (url) handleUrl(url)
      setHasHandledInitialUrl(true)
    })
  }, [hasHandledInitialUrl, handleUrl])

  useEffect(() => {
    const eventListener = Linking.addEventListener('url', (event) => handleUrl(event.url))
    return () => eventListener.remove()
  }, [handleUrl])

  return <>{children}</>
}
