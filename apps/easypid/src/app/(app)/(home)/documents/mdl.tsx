import { MdlFlow } from '@easypid/features/documents/MdlFlow'
import { credentialDataHandlerOptions } from '../../_layout'

export default function Screen() {
  return <MdlFlow credentialDataHandlerOptions={{ ...credentialDataHandlerOptions, routeMethod: 'replace' }} />
}
