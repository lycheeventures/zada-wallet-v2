import { PassportFlow } from '@easypid/features/passport/PassportFlow'
import { credentialDataHandlerOptions } from '../_layout'

export default function Screen() {
  return <PassportFlow credentialDataHandlerOptions={{ ...credentialDataHandlerOptions, routeMethod: 'replace' }} />
}
