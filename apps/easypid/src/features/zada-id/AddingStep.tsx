import { Trans, useLingui } from '@lingui/react/macro'
import { Button, Heading, HeroIcons, Paragraph, ProgressBar, Spinner, YStack } from '@package/ui'

export interface AddResult {
  label: string
  status: 'pending' | 'ok' | 'failed'
  error?: string
}

interface AddingStepProps {
  results: AddResult[]
  finished: boolean
  onDone: () => void
  onRetryFailed?: () => void
}

/** Sequential issuance progress, then a summary. The ZADA ID is always the first row. */
export function AddingStep({ results, finished, onDone, onRetryFailed }: AddingStepProps) {
  const { t } = useLingui()
  const done = results.filter((r) => r.status === 'ok').length
  const failed = results.filter((r) => r.status === 'failed')
  const processed = done + failed.length
  const progress = results.length ? Math.round((processed / results.length) * 100) : 0
  const zadaIdOk = results[0]?.status === 'ok'

  return (
    <YStack f={1} jc="center" ai="center" gap="$4" py="$6">
      {!finished ? (
        <>
          <Spinner />
          <Heading heading="h2" ta="center">
            {t({ id: 'zadaId.adding.title', message: 'Adding to your wallet…' })}
          </Heading>
          <Paragraph ta="center" color="$grey-500">
            <Trans id="zadaId.adding.progress">
              {processed} of {results.length} added. Keep the app open.
            </Trans>
          </Paragraph>
        </>
      ) : (
        <>
          {failed.length === 0 ? (
            <HeroIcons.CheckCircleFilled color="$positive-500" size={56} />
          ) : (
            <HeroIcons.ExclamationCircleFilled color="$warning-500" size={56} />
          )}
          <Heading heading="h2" ta="center">
            {failed.length === 0
              ? t({ id: 'zadaId.done.allSet', message: 'All set' })
              : zadaIdOk
                ? t({ id: 'zadaId.done.almost', message: 'Almost there' })
                : t({ id: 'zadaId.done.idFailed', message: 'Your ZADA ID could not be created' })}
          </Heading>
          <Paragraph ta="center" color="$grey-500">
            <Trans id="zadaId.done.summary">{done} added to your wallet.</Trans>
          </Paragraph>
          {failed.length > 0 ? (
            <YStack gap="$1" w="100%" p="$3" br="$5" bg="$grey-100">
              {failed.map((f) => (
                <Paragraph key={f.label} variant="sub" color="$grey-700">
                  {f.label}: {f.error ?? t({ id: 'zadaId.done.failedGeneric', message: 'could not be added' })}
                </Paragraph>
              ))}
            </YStack>
          ) : null}
        </>
      )}
      <YStack w="100%" gap="$3" pt="$2">
        <ProgressBar value={progress} />
        {finished ? (
          <>
            {failed.length > 0 && onRetryFailed ? (
              <Button.Outline onPress={onRetryFailed}>
                {t({ id: 'zadaId.done.retryFailed', message: 'Try the failed ones again' })}
              </Button.Outline>
            ) : null}
            <Button.Solid onPress={onDone}>{t({ id: 'zadaId.done.button', message: 'Done' })}</Button.Solid>
          </>
        ) : null}
      </YStack>
    </YStack>
  )
}
