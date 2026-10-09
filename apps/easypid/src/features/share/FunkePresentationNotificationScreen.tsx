import type { OverAskingResponse } from '@easypid/use-cases/OverAskingApi'
import type {
  DisplayImage,
  FormattedSubmission,
  FormattedTransactionData,
  TrustedEntity,
  TrustMechanism,
} from '@package/agent'
import { type SlideStep, SlideWizard } from '@package/app'
import { InteractionErrorSlide } from '../receive/slides/InteractionErrorSlide'
import { LoadingRequestSlide } from '../receive/slides/LoadingRequestSlide'
import { VerifyPartySlide } from '../receive/slides/VerifyPartySlide'
import { PinSlide } from './slides/PinSlide'
import { PresentationSuccessSlide } from './slides/PresentationSuccessSlide'
import { ReviewAndShareSlide } from './slides/ReviewAndShareSlide'
import { SignAndShareSlide } from './slides/SignAndShareSlide'
import { SigningSlide } from './slides/SigningSlide'

interface FunkePresentationNotificationScreenProps {
  entityId?: string
  verifierName?: string
  logo?: DisplayImage
  overAskingResponse?: OverAskingResponse
  trustedEntities?: Array<TrustedEntity>
  trustMechanism?: TrustMechanism
  submission?: FormattedSubmission
  usePin: boolean
  isAccepting: boolean
  transaction?: FormattedTransactionData
  onAccept: () => Promise<void>
  onDecline: () => void
  onCancel: () => void
  onComplete: () => void
  errorReason?: string
}

export function FunkePresentationNotificationScreen({
  entityId,
  verifierName,
  logo,
  usePin,
  onAccept,
  onCancel,
  onDecline,
  isAccepting,
  submission,
  onComplete,
  overAskingResponse,
  trustedEntities,
  trustMechanism,
  transaction,
  errorReason,
}: FunkePresentationNotificationScreenProps) {
  return (
    <SlideWizard
      steps={
        [
          {
            step: 'loading-request',
            progress: 20,
            screen: <LoadingRequestSlide key="loading-request" isLoading={!submission} isError={false} />,
          },
          ...(submission
            ? transaction?.type === 'qes_authorization'
              ? [
                  // Signing keeps the stepped flow: the party check, the QTSP/document step and the
                  // sign-and-share step each carry their own decision.
                  {
                    step: 'verify-issuer',
                    progress: 33,
                    backIsCancel: true,
                    screen: (
                      <VerifyPartySlide
                        key="verify-issuer"
                        type="signing"
                        entityId={entityId}
                        name={verifierName}
                        logo={logo}
                        trustedEntities={trustedEntities}
                        trustMechanism={trustMechanism}
                      />
                    ),
                  },
                  {
                    step: 'signing',
                    progress: 50,
                    screen: <SigningSlide qtsp={transaction.qtsp} documentName={transaction.documentName} />,
                  },
                  {
                    step: 'share-credentials',
                    progress: 66,
                    screen: (
                      <SignAndShareSlide
                        key="sign-and-share-credentials"
                        onAccept={usePin ? undefined : onAccept}
                        onDecline={onDecline}
                        isAccepting={isAccepting}
                        qtsp={transaction.qtsp}
                        documentName={transaction.documentName}
                        cardForSigningId={transaction.cardForSigningId}
                        submission={submission}
                      />
                    ),
                  },
                ]
              : [
                  // Plain presentation: one screen holds the party + trust facts, the purpose and
                  // the requested cards, so the decision is a single screen and a single tap.
                  {
                    step: 'share-credentials',
                    progress: 66,
                    backIsCancel: true,
                    screen: (
                      <ReviewAndShareSlide
                        key="share-credentials"
                        entityId={entityId}
                        verifierName={verifierName}
                        logo={logo}
                        trustedEntities={trustedEntities}
                        trustMechanism={trustMechanism}
                        submission={submission}
                        overAskingResponse={overAskingResponse}
                        isAccepting={isAccepting}
                        onAccept={usePin ? undefined : onAccept}
                        onDecline={onDecline}
                      />
                    ),
                  },
                ]
            : []),
          usePin && {
            step: 'pin-enter',
            progress: 82.5,
            screen: <PinSlide key="pin-enter" isLoading={isAccepting} onPinSubmit={onAccept} />,
          },
          {
            step: 'success',
            progress: 100,
            backIsCancel: true,
            screen: <PresentationSuccessSlide showReturnToApp verifierName={verifierName} onComplete={onComplete} />,
          },
        ].filter(Boolean) as SlideStep[]
      }
      errorScreen={() => (
        <InteractionErrorSlide
          key="presentation-error"
          flowType={transaction?.type === 'qes_authorization' ? 'sign' : 'verify'}
          reason={errorReason}
          onCancel={onCancel}
        />
      )}
      isError={!!errorReason}
      onCancel={onDecline}
    />
  )
}
