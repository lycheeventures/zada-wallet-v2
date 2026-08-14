import 'fast-text-encoding'

import { TypedArrayEncoder } from '@credo-ts/core'
import { allowedRedirectBaseUrls, appScheme } from '@easypid/constants'
import { setPendingDeeplink } from '@easypid/utils/pendingDeeplink'
import { logger, parseInvitationUrlSync } from '@package/agent'
import { deeplinkSchemes } from '@package/app'
import * as Haptics from 'expo-haptics'
import { router } from 'expo-router'
import * as WebBrowser from 'expo-web-browser'
import { Platform } from 'react-native'
import { credentialDataHandlerOptions } from './(app)/_layout'

// The ZADA ID / migration web flow runs in an in-app browser (WebBrowser.openBrowserAsync).
// On iOS that's an SFSafariViewController that stays presented on top of the app when its
// "Add to wallet" deep link fires — the wallet navigates (usually to the PIN unlock screen)
// invisibly behind the overlay, so the button feels dead until the user closes the browser by
// hand. Dismiss it here, at deep-link time, rather than in a destination screen: the
// /authenticate gate mounts before any credential screen, so a screen-level dismiss runs too
// late. Fire-and-forget — this handler must stay sync (see note above redirectSystemPath).
// Not needed on Android, where the Custom Tab is backgrounded by the intent automatically.
function dismissInAppBrowser() {
  if (Platform.OS !== 'ios') return
  WebBrowser.dismissBrowser().catch(() => {})
}

// NOTE: previously we had this method async, but somehow this prevent the
// deeplink from working on a cold startup. We updated the invitation handler to
// be fully sync.
export function redirectSystemPath({ path, initial }: { path: string; initial: boolean }) {
  logger.debug(`Handling deeplink for path ${path}.`, {
    initial,
  })

  // Batch credential import from the migration web flow: a single app-scheme deep link
  // (id.animo.paradym:///wallet/credential-offer-batch?batch=<token>) whose short token the
  // batch screen exchanges for the offer list. A legacy inline `?offers=[...]` param is still
  // accepted. Handled here, before the invitation-scheme check, because it uses the app scheme
  // rather than a standard invitation scheme. We forward the original query string verbatim so
  // whichever param is present reaches the screen.
  if (path.startsWith(`${appScheme}:`) && path.includes('/wallet/credential-offer-batch')) {
    try {
      const { search } = new URL(path)
      if (search.includes('batch=') || search.includes('offers=')) {
        let redirectPath = `/notifications/credentialBatch${search}`
        // Also record the target out-of-band: the authenticate-wrapper navigation below is racy
        // on Android (deeplink vs AppState lock vs layout redirect) and can drop the
        // redirectAfterUnlock param — see pendingDeeplink.ts.
        setPendingDeeplink(redirectPath)
        if (!initial) {
          const encodedRedirect = TypedArrayEncoder.toBase64URL(TypedArrayEncoder.fromString(redirectPath))
          redirectPath = `/authenticate?redirectAfterUnlock=${encodedRedirect}`
        }
        logger.debug('Deeplink is a batch credential import. Routing to batch screen.')
        dismissInAppBrowser()
        return redirectPath
      }
    } catch (_error) {
      // fall through to normal handling
    }
  }

  const isRecognizedDeeplink = deeplinkSchemes.some((scheme) => path.startsWith(scheme))
  if (!isRecognizedDeeplink) {
    logger.debug(
      'Deeplink is not a recognized deeplink scheme, routing to deeplink directly instead of parsing as invitation.'
    )
    return path
  }

  try {
    // For the bdr mDL issuer we use authorized code flow, but they also
    // redirect to the ausweis app. From the ausweis app we are then redirected
    // back to the easypid wallet.
    const parsedPath = new URL(path)
    const credentialAuthorizationCode = parsedPath.searchParams.get('code')

    const isUniversalRedirect =
      allowedRedirectBaseUrls?.some((redirectBaseUrl) => {
        const parsedRedirectBaseUrl = new URL(redirectBaseUrl)
        return (
          parsedRedirectBaseUrl.host === parsedPath.host &&
          parsedRedirectBaseUrl.pathname === parsedPath.pathname &&
          parsedRedirectBaseUrl.host === parsedPath.host
        )
      }) ?? false

    const isDeeplinkRedirect = parsedPath.protocol === `${appScheme}:` && parsedPath.pathname === '/wallet/redirect'

    // TODO: we should handle if no `credentialAuthorizationCode` is present
    // but an `error` and `error_description` and set these so we can show the
    // error on the authorization screen. Or at least handle the flow correctly
    // currently it will just redirect as if there's an invitation to be processed.
    if ((isUniversalRedirect || isDeeplinkRedirect) && credentialAuthorizationCode) {
      logger.debug(
        'Link is redirect after authorization code flow. Setting credentialAuthorizationCode search param, but not routing to any screen',
        {
          credentialAuthorizationCode,
        }
      )
      // We just set the credentialAuthorizationCode, which should be handled by the browser
      // auth session code in the credential screen that is open.
      router.setParams({ credentialAuthorizationCode })
      return null
    }

    const parseResult = parseInvitationUrlSync(path)
    if (!parseResult.success) {
      logger.info('Deeplink is not a valid invitation. Routing to home screen', {
        error: parseResult.error,
        message: parseResult.message,
      })

      return '/'
    }

    const invitationData = parseResult.result

    let redirectPath: string | undefined

    if (!credentialDataHandlerOptions.allowedInvitationTypes.includes(invitationData.type)) {
      logger.warn(`Invitation type ${invitationData.type} is not allowed. Routing to home screen`)
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      return '/'
    }

    if (invitationData.type === 'openid-credential-offer') {
      redirectPath = `/notifications/openIdCredential?uri=${encodeURIComponent(invitationData.data)}`
    }
    if (invitationData.type === 'openid-authorization-request') {
      redirectPath = `/notifications/openIdPresentation?uri=${encodeURIComponent(invitationData.data)}`
    }
    if (invitationData.type === 'didcomm') {
      redirectPath = `/notifications/didcomm?invitationUrl=${encodeURIComponent(invitationData.data)}`
    }

    if (redirectPath) {
      // Out-of-band copy of the target — survives the Android navigation races that can drop
      // the redirectAfterUnlock param. See pendingDeeplink.ts.
      setPendingDeeplink(redirectPath)

      // Always make the user authenticate first when opening with a deeplink
      // On initial load this is already the case so we skip it
      if (!initial) {
        const encodedRedirect = TypedArrayEncoder.toBase64URL(TypedArrayEncoder.fromString(redirectPath))
        redirectPath = `/authenticate?redirectAfterUnlock=${encodedRedirect}`
      }

      logger.debug(`Redirecting to path ${redirectPath}`)
      dismissInAppBrowser()
      return redirectPath
    }

    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
    return '/'
  } catch (_error) {
    return '/'
  }
}
