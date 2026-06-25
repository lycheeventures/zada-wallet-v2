import { Platform, PermissionsAndroid } from 'react-native'
import { cborDecode, cborEncode, DataItem, DeviceRequest } from '@animo-id/mdoc'
import {
  CredentialMultiInstanceUseMode,
  type Mdoc,
  MdocService,
  useInstanceFromCredentialRecord,
} from '@credo-ts/core'
import type { AppAgent } from '@easypid/agent'
import type { FormattedSubmission, MdocRecord } from '@package/agent'

// ✅ SAFE import (Android only)
let mdocDataTransfer: any

if (Platform.OS === 'android') {
  mdocDataTransfer =
    require('@animo-id/expo-mdoc-data-transfer').mdocDataTransfer
}

type ShareDeviceResponseOptions = {
  sessionTranscript: Uint8Array
  deviceRequest: Uint8Array
  agent: AppAgent
  submission: FormattedSubmission
}

export const requestMdocPermissions = async () => {
  if (Platform.OS !== 'android') return

  if (Platform.Version >= 31) {
    return await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADVERTISE,
    ])
  }

  return await PermissionsAndroid.requestMultiple([
    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
  ])
}

export const checkMdocPermissions = async () => {
  if (Platform.OS !== 'android') return true

  if (Platform.Version >= 31) {
    return await PermissionsAndroid.check(
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN
    )
  }

  return await PermissionsAndroid.check(
    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
  )
}

export const getMdocQrCode = async () => {
  if (!mdocDataTransfer) {
    throw new Error('Mdoc not supported on this platform')
  }

  const mdt = mdocDataTransfer.instance()
  const qrData = await mdt.startQrEngagement()
  mdt.enableNfc()
  return qrData
}

/**
 * Wait for the device request
 */
export const waitForDeviceRequest = async () => {
  if (!mdocDataTransfer) {
    throw new Error('Mdoc not supported on this platform')
  }

  const mdt = mdocDataTransfer.instance()
  const { deviceRequest, sessionTranscript } =
    await mdt.waitForDeviceRequest()

  const encodedSessionTranscript =
    Platform.OS === 'android'
      ? cborEncode(DataItem.fromData(cborDecode(sessionTranscript)))
      : sessionTranscript

  return { deviceRequest, sessionTranscript: encodedSessionTranscript }
}

/**
 * Send a device response
 */
export const shareDeviceResponse = async (
  options: ShareDeviceResponseOptions
) => {
  if (!mdocDataTransfer) {
    throw new Error('Mdoc not supported on this platform')
  }

  const mdocs = await Promise.all(
    options.submission.entries.map(async (e) => {
      if (!e.isSatisfied) {
        throw new Error(
          `Requirement for doctype ${e.inputDescriptorId} not satisfied`
        )
      }

      const credentialRecord =
        e.credentials[0].credential.record as MdocRecord

      const { credentialInstance } =
        await useInstanceFromCredentialRecord({
          credentialRecord,
          agentContext: options.agent.context,
          useMode: CredentialMultiInstanceUseMode.NewOrFirst,
        })

      return credentialInstance
    })
  )

  const mdocService =
    options.agent.dependencyManager.resolve(MdocService)

  const deviceResponse =
    await mdocService.createDeviceResponse(
      options.agent.context,
      {
        documentRequests: DeviceRequest.parse(
          options.deviceRequest
        ).docRequests.map((d) => ({
          docType: d.itemsRequest.data.docType,
          nameSpaces: Object.fromEntries(
            Array.from(
              d.itemsRequest.data.nameSpaces.entries()
            ).map(([namespace, entry]) => [
              namespace,
              Object.fromEntries(Array.from(entry.entries())),
            ])
          ),
        })),
        mdocs: mdocs as [Mdoc, ...Mdoc[]],
        sessionTranscriptOptions: {
          type: 'sesionTranscriptBytes',
          sessionTranscriptBytes: options.sessionTranscript,
        },
      }
    )

  const mdt = mdocDataTransfer.instance()
  await mdt.sendDeviceResponse(deviceResponse)
}

export const shutdownDataTransfer = () => {
  if (!mdocDataTransfer) return

  if (isDataTransferInitialized()) {
    const mdt = mdocDataTransfer.instance()
    mdt.shutdown()
  }
}

export const isDataTransferInitialized = () => {
  if (!mdocDataTransfer) return false
  return mdocDataTransfer.isInitialized()
}