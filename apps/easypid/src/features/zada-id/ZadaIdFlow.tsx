import { useAppAgent } from '@easypid/agent'
import { useLingui } from '@lingui/react/macro'
import { usePushToWallet } from '@package/app'
import { commonMessages } from '@package/translations'
import { Button, Paragraph, YStack } from '@package/ui'
import { useRouter } from 'expo-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import { mmkv } from '../../storage/mmkv'
import { HAS_ZADA_ID_ONBOARDED_KEY, useCredentialMigration } from '../migration/useCredentialMigration'
import { acceptPreAuthorizedOffer } from '../receive/acceptPreAuthorizedOffer'
import { AddingStep, type AddResult } from './AddingStep'
import { CodeStep } from './CodeStep'
import { EmailStep } from './EmailStep'
import { FlowShell } from './FlowShell'
import {
  clearFlowState,
  emptyFlowState,
  type FlowStep,
  loadFlowState,
  saveFlowState,
  type ZadaIdFlowState,
} from './flowState'
import { NameStep } from './NameStep'
import { PhoneStep } from './PhoneStep'
import { ReviewStep } from './ReviewStep'
import { type DiscoverResult, type OtpChannel, UsherUnreachableError, usherApi } from './usherApi'

const PROGRESS: Record<FlowStep, number> = { phone: 15, phoneCode: 30, email: 45, emailCode: 60, name: 75, review: 90 }
// Mirrors the usher's default OTP_SEND_COOLDOWN_SECONDS so the button only appears when a resend
// will actually be accepted.
const RESEND_COOLDOWN_MS = 60_000

interface AddItem {
  label: string
  claim: () => Promise<string>
}

/**
 * Native ZADA ID setup + legacy credential migration — the same six steps as the web flow at
 * migrate.zada.solutions (phone → code → email → code → name → review), run as in-app screens
 * against the usher's `/api/v1` and finished on the wallet's own credential rail. No browser, no
 * deep link back into the app, and each offer is accepted right here.
 *
 * Why native: this is now every new user's first step ("Create ZADA ID" == "Migrate" == the
 * final onboarding step), and the browser hand-off cost a class of platform bugs — the iOS
 * overlay that hid the wallet, WebKit's user-gesture block on custom schemes, the truncated long
 * deep link, the 60-second lock stripping the return route. The web flow stays as the fallback
 * (`useCredentialMigration`) when the API can't be reached.
 *
 * Flow state is persisted for the length of the session (see `flowState.ts`) so a lock while the
 * user reads the SMS resumes on the same screen.
 */
export function ZadaIdFlow() {
  const { t } = useLingui()
  const router = useRouter()
  const { agent } = useAppAgent()
  const pushToWallet = usePushToWallet()
  const { startMigration } = useCredentialMigration()

  const [state, setState] = useState<ZadaIdFlowState>(() => loadFlowState() ?? emptyFlowState())
  const [phase, setPhase] = useState<'steps' | 'adding'>('steps')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [unreachable, setUnreachable] = useState(false)
  const [devCode, setDevCode] = useState<string | undefined>()
  const [resendAvailableAt, setResendAvailableAt] = useState(0)
  const [discoveringPhone, setDiscoveringPhone] = useState(false)
  const [discoveringEmail, setDiscoveringEmail] = useState(false)
  const [discoveryNote, setDiscoveryNote] = useState<string | undefined>()
  const [notifyStatus, setNotifyStatus] = useState<'idle' | 'busy' | 'done'>('idle')
  const [results, setResults] = useState<AddResult[]>([])
  const [finished, setFinished] = useState(false)
  const itemsRef = useRef<AddItem[]>([])

  // Persist every change while the user is still choosing; once issuance starts the session is
  // spent (tokens are single-purpose) and the state is cleared at the end.
  useEffect(() => {
    if (phase === 'steps') saveFlowState(state)
  }, [state, phase])

  const patch = useCallback(
    (p: Partial<ZadaIdFlowState> | ((s: ZadaIdFlowState) => Partial<ZadaIdFlowState>)) =>
      setState((s) => ({ ...s, ...(typeof p === 'function' ? p(s) : p) })),
    []
  )

  const run = useCallback(
    async (fn: () => Promise<void>) => {
      setBusy(true)
      setError(null)
      setUnreachable(false)
      try {
        await fn()
      } catch (e) {
        if (e instanceof UsherUnreachableError) setUnreachable(true)
        setError(e instanceof Error && e.message ? e.message : t(commonMessages.somethingWentWrong))
      } finally {
        setBusy(false)
      }
    },
    [t]
  )

  const mergeDiscovery = useCallback(
    (kind: 'phone' | 'email', result: DiscoverResult) =>
      patch((s) => {
        const known = new Set(s.credentials.map((c) => c.id))
        const added = result.credentials.filter((c) => !known.has(c.id)).map((c) => ({ ...c, token: result.token }))
        const blockedKey = (b: { tenant_db: string; legacy_schema_id: string }) =>
          `${b.tenant_db}|${b.legacy_schema_id}`
        const knownBlocked = new Set(s.blocked.map(blockedKey))
        const addedBlocked = result.blocked.filter((b) => !knownBlocked.has(blockedKey(b)))
        return {
          credentials: [...s.credentials, ...added],
          blocked: [...s.blocked, ...addedBlocked],
          // The discovery token supersedes the verify token: same anchor, plus the credential list
          // the claim endpoint needs.
          ...(kind === 'phone'
            ? { phoneToken: result.token, phoneDiscovered: true }
            : { emailToken: result.token, emailDiscovered: true }),
        }
      }),
    [patch]
  )

  // Legacy-credential discovery runs in the background while the user continues — it fans out
  // across the old tenant databases and can take a while. Failure is never fatal: the ZADA ID
  // itself doesn't depend on it.
  const discover = useCallback(
    (kind: 'phone' | 'email', token: string) => {
      const setDiscovering = kind === 'phone' ? setDiscoveringPhone : setDiscoveringEmail
      setDiscovering(true)
      const call = kind === 'phone' ? usherApi.discoverPhone : usherApi.discoverEmail
      call(token)
        .then((result) => {
          mergeDiscovery(kind, result)
          if (result.devNote) setDiscoveryNote(result.devNote)
        })
        .catch((e: unknown) => {
          agent.config.logger.warn('ZADA ID: legacy discovery failed', { kind, error: e })
          setDiscoveryNote(
            t({
              id: 'zadaId.review.discoveryFailed',
              message: "We couldn't check for earlier credentials right now. You can migrate them later from the menu.",
            })
          )
          patch(kind === 'phone' ? { phoneDiscovered: true } : { emailDiscovered: true })
        })
        .finally(() => setDiscovering(false))
    },
    [agent, mergeDiscovery, patch, t]
  )

  // Resumed after a lock (or a crash) with discovery still outstanding — pick it up again.
  const resumed = useRef(false)
  useEffect(() => {
    if (resumed.current) return
    resumed.current = true
    if (state.phoneToken && !state.phoneDiscovered) discover('phone', state.phoneToken)
    if (state.emailToken && !state.emailDiscovered) discover('email', state.emailToken)
  }, [discover, state.phoneToken, state.phoneDiscovered, state.emailToken, state.emailDiscovered])

  // ----- step handlers -------------------------------------------------------------------------

  const onPhoneSubmit = (phone: string, channel: OtpChannel) =>
    run(async () => {
      const r = await usherApi.sendOtp(phone, channel)
      setDevCode(r.devCode)
      setResendAvailableAt(Date.now() + RESEND_COOLDOWN_MS)
      patch({ phone, step: 'phoneCode' })
    })

  const onPhoneResend = (channel?: OtpChannel) =>
    run(async () => {
      if (!state.phone) return
      const r = await usherApi.sendOtp(state.phone, channel ?? 'sms')
      setDevCode(r.devCode)
      setResendAvailableAt(Date.now() + RESEND_COOLDOWN_MS)
    })

  const onPhoneCode = (code: string) =>
    run(async () => {
      if (!state.phone) return
      const r = await usherApi.verifyOtp(state.phone, code)
      setDevCode(undefined)
      patch({ phoneToken: r.token, maskedPhone: r.maskedPhone, step: 'email' })
      discover('phone', r.token)
    })

  const onEmailSubmit = (email: string) =>
    run(async () => {
      const r = await usherApi.sendEmailOtp(email)
      setDevCode(r.devCode)
      setResendAvailableAt(Date.now() + RESEND_COOLDOWN_MS)
      patch({ email, step: 'emailCode' })
    })

  const onEmailResend = () =>
    run(async () => {
      if (!state.email) return
      const r = await usherApi.sendEmailOtp(state.email)
      setDevCode(r.devCode)
      setResendAvailableAt(Date.now() + RESEND_COOLDOWN_MS)
    })

  const onEmailCode = (code: string) =>
    run(async () => {
      if (!state.email) return
      const r = await usherApi.verifyEmailOtp(state.email, code)
      setDevCode(undefined)
      patch({ emailToken: r.token, step: 'name' })
      discover('email', r.token)
    })

  const onName = (name: string) => {
    setError(null)
    patch({ name, step: 'review' })
  }

  const onToggle = (id: string) =>
    patch((s) => ({
      deselected: s.deselected.includes(id) ? s.deselected.filter((x) => x !== id) : [...s.deselected, id],
    }))

  const onNotify = async () => {
    setNotifyStatus('busy')
    // Each token carries the blocked list its own discovery found; register both.
    const tokens = [state.phoneToken, state.emailToken].filter((x): x is string => !!x)
    await Promise.allSettled(tokens.map((token) => usherApi.notifyWhenReady(token)))
    setNotifyStatus('done')
  }

  const runAdd = useCallback(
    async (indexes: number[]) => {
      setFinished(false)
      for (const i of indexes) {
        const item = itemsRef.current[i]
        if (!item) continue
        setResults((rs) => rs.map((r, j) => (j === i ? { ...r, status: 'pending', error: undefined } : r)))
        try {
          const offerUrl = await item.claim()
          await acceptPreAuthorizedOffer(agent, offerUrl)
          setResults((rs) => rs.map((r, j) => (j === i ? { ...r, status: 'ok' } : r)))
        } catch (e) {
          agent.config.logger.error('ZADA ID: adding a credential failed', { label: item.label, error: e })
          const message = e instanceof Error && e.message ? e.message : undefined
          setResults((rs) => rs.map((r, j) => (j === i ? { ...r, status: 'failed', error: message } : r)))
        }
      }
      setFinished(true)
    },
    [agent]
  )

  const onAdd = () => {
    const { phoneToken, emailToken, name } = state
    if (!phoneToken || !emailToken || !name) {
      setError(t({ id: 'zadaId.review.incomplete', message: 'Please verify your phone and email first.' }))
      return
    }
    const selected = state.credentials.filter((c) => !state.deselected.includes(c.id))
    itemsRef.current = [
      {
        label: t({ id: 'zadaId.itemZadaId', message: 'ZADA ID' }),
        claim: async () => (await usherApi.claimZadaId(phoneToken, emailToken, name)).offerUrl,
      },
      ...selected.map((c) => ({
        label: c.display_name,
        // One claim per credential, and only for the ones the user left selected.
        claim: async () => (await usherApi.claimCredential(c.token, c.id)).offerUrl,
      })),
    ]
    setResults(itemsRef.current.map((it) => ({ label: it.label, status: 'pending' })))
    setPhase('adding')
    // The session is consumed from here on; the persisted copy must not resurrect it.
    clearFlowState()
    void runAdd(itemsRef.current.map((_, i) => i))
  }

  const onRetryFailed = () => void runAdd(results.map((r, i) => (r.status === 'failed' ? i : -1)).filter((i) => i >= 0))

  const onDone = () => {
    if (results[0]?.status === 'ok') mmkv.set(HAS_ZADA_ID_ONBOARDED_KEY, true)
    pushToWallet()
  }

  const onClose = () => {
    clearFlowState()
    router.back()
  }

  const onOpenInBrowser = async () => {
    clearFlowState()
    await startMigration()
    router.back()
  }

  const onBack = (() => {
    switch (state.step) {
      case 'phoneCode':
        return () => {
          setError(null)
          patch({ step: 'phone' })
        }
      case 'emailCode':
        return () => {
          setError(null)
          patch({ step: 'email' })
        }
      case 'review':
        return () => patch({ step: 'name' })
      default:
        return undefined
    }
  })()

  // ----- render --------------------------------------------------------------------------------

  if (phase === 'adding') {
    return (
      <FlowShell title="" progress={finished ? 100 : 95}>
        <AddingStep results={results} finished={finished} onDone={onDone} onRetryFailed={onRetryFailed} />
      </FlowShell>
    )
  }

  const errorBlock = error ? (
    <YStack gap="$2">
      <Paragraph color="$danger-500">{error}</Paragraph>
      {unreachable ? (
        <Button.Outline onPress={onOpenInBrowser}>
          {t({ id: 'zadaId.openInBrowser', message: 'Open in browser instead' })}
        </Button.Outline>
      ) : null}
    </YStack>
  ) : null

  const copy: Record<FlowStep, { title: string; subtitle?: string }> = {
    phone: {
      title: t({ id: 'zadaId.phone.title', message: 'Get your ZADA ID' }),
      subtitle: t({
        id: 'zadaId.phone.subtitle',
        message: 'Verify your phone to create your ZADA ID and bring any existing credentials into your wallet.',
      }),
    },
    phoneCode: { title: t({ id: 'zadaId.code.title', message: 'Enter the code' }) },
    email: {
      title: t({ id: 'zadaId.email.title', message: 'Verify your email' }),
      subtitle: t({
        id: 'zadaId.email.subtitle',
        message: 'Your ZADA ID includes a verified email. We also use it to find credentials registered to it.',
      }),
    },
    emailCode: { title: t({ id: 'zadaId.code.title', message: 'Enter the code' }) },
    name: {
      title: t({ id: 'zadaId.name.title', message: 'Your name' }),
      subtitle: t({
        id: 'zadaId.name.subtitle',
        message:
          "Enter your full name for your ZADA ID. It isn't stored anywhere else — it only goes on the credential.",
      }),
    },
    review: {
      title: t({ id: 'zadaId.review.title', message: 'Ready to add' }),
      subtitle: t({
        id: 'zadaId.review.subtitle',
        message: 'Your ZADA ID is ready. Choose which existing credentials to bring into this wallet.',
      }),
    },
  }

  return (
    <FlowShell
      title={copy[state.step].title}
      subtitle={copy[state.step].subtitle}
      progress={PROGRESS[state.step]}
      onBack={busy ? undefined : onBack}
      onClose={busy ? undefined : onClose}
      footer={
        state.step === 'phone' ? <Button.Text onPress={onClose}>{t(commonMessages.setUpLater)}</Button.Text> : undefined
      }
    >
      {errorBlock}
      {state.step === 'phone' && <PhoneStep initialPhone={state.phone} busy={busy} onSubmit={onPhoneSubmit} />}
      {state.step === 'phoneCode' && (
        <CodeStep
          key="phone"
          kind="phone"
          destination={state.maskedPhone ?? state.phone ?? ''}
          busy={busy}
          error={error}
          devCode={devCode}
          resendAvailableAt={resendAvailableAt}
          onSubmit={onPhoneCode}
          onResend={onPhoneResend}
        />
      )}
      {state.step === 'email' && <EmailStep initialEmail={state.email} busy={busy} onSubmit={onEmailSubmit} />}
      {state.step === 'emailCode' && (
        <CodeStep
          key="email"
          kind="email"
          destination={state.email ?? ''}
          busy={busy}
          error={error}
          devCode={devCode}
          resendAvailableAt={resendAvailableAt}
          onSubmit={onEmailCode}
          onResend={onEmailResend}
        />
      )}
      {state.step === 'name' && <NameStep initialName={state.name} busy={busy} onSubmit={onName} />}
      {state.step === 'review' && (
        <ReviewStep
          state={state}
          discovering={discoveringPhone || discoveringEmail}
          discoveryNote={discoveryNote}
          notifyStatus={notifyStatus}
          busy={busy}
          onToggle={onToggle}
          onNotify={onNotify}
          onAdd={onAdd}
        />
      )}
    </FlowShell>
  )
}
