import { matchDocumentSourceUrl, stashPendingSourceUrl } from '@easypid/features/documents/documentSources'
import { QrScannerScreen } from '@package/app'
import { router } from 'expo-router'
import { credentialDataHandlerOptions } from '../_layout'

// Scanning an official-document QR (e.g. the RTAD link on a Myanmar driver license) from the
// main scanner routes into the document flow instead of failing as an unrecognized invitation.
function interceptDocumentScan(data: string): boolean {
  const match = matchDocumentSourceUrl(data)
  if (!match) return false
  stashPendingSourceUrl(match.sourceUrl)
  router.replace('/documents/mdl')
  return true
}

export default function Screen() {
  return (
    <QrScannerScreen
      credentialDataHandlerOptions={{ ...credentialDataHandlerOptions, routeMethod: 'replace' }}
      interceptScan={interceptDocumentScan}
    />
  )
}
