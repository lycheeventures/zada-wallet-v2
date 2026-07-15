import {
  AnonCredsDidCommCredentialFormatService,
  AnonCredsDidCommProofFormatService,
  AnonCredsModule,
  DidCommCredentialV1Protocol,
  DidCommProofV1Protocol,
  LegacyIndyDidCommCredentialFormatService,
  LegacyIndyDidCommProofFormatService,
} from '@credo-ts/anoncreds'
import { AskarKeyManagementService, AskarModule } from '@credo-ts/askar'
import { CheqdAnonCredsRegistry, CheqdDidResolver, CheqdModule, CheqdModuleConfig } from '@credo-ts/cheqd'
import {
  Agent,
  DidsModule,
  JwkDidRegistrar,
  JwkDidResolver,
  KeyDidRegistrar,
  KeyDidResolver,
  Kms,
  PeerDidNumAlgo,
  WebDidResolver,
  X509Module,
} from '@credo-ts/core'
import {
  DidCommAutoAcceptCredential,
  DidCommAutoAcceptProof,
  DidCommCredentialV2Protocol,
  DidCommHttpOutboundTransport,
  DidCommMediatorPickupStrategy,
  DidCommModule,
  DidCommProofV2Protocol,
  DidCommWsOutboundTransport,
} from '@credo-ts/didcomm'
import { OpenId4VcModule } from '@credo-ts/openid4vc'

export { useAgent } from './providers'

import { agentDependencies, SecureEnvironmentKeyManagementService } from '@credo-ts/react-native'
import { anoncreds } from '@hyperledger/anoncreds-react-native'
import { askar } from '@openwallet-foundation/askar-react-native'
import { DidWebAnonCredsRegistry } from 'credo-ts-didweb-anoncreds'
import { logger } from './logger'
import { getZadaRegistryAnchorsForIssuer } from './utils/trust'

const WELL_KNOWN_CREDENTIAL_ISSUER = '.well-known/openid-credential-issuer'

/**
 * Ask issuers for *signed* credential-issuer metadata.
 *
 * OpenID4VCI lets an issuer return its credential-issuer metadata as a signed JWT
 * (`typ: openidvci-issuer-metadata+jwt`, carrying an `x5c` chain) instead of plain JSON, selected by
 * content negotiation. That signature is what binds the issuer's signing key to its trust-registry
 * entry — without it, a `credential_issuer` URL is self-asserted and proves nothing.
 *
 * Hovi serves the signed form ONLY when `Accept: application/jwt` is sent; a plain GET (or the
 * `Accept: * / *` React Native's fetch sends by default) returns unsigned JSON. credo validates the
 * response content type but never sends an `Accept` header of its own, so it silently receives the
 * unsigned form and issuer trust degrades to a registry URL lookup. We add the header here so the
 * signed form is requested; `application/json` stays in the list so issuers that don't sign their
 * metadata keep working.
 *
 * Paired with the `openId4VciCredentialIssuerMetadata` case in `getTrustedCertificatesForVerification`
 * below: credo *throws* if it can't verify a signed metadata JWT, so requesting the signed form
 * without also supplying the right trust anchor would break issuance. The two must stay together.
 */
const withSignedIssuerMetadataAccept = (fetch: typeof agentDependencies.fetch): typeof agentDependencies.fetch => {
  return (async (input: unknown, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : ((input as { url?: string })?.url ?? '')

    if (!url.includes(WELL_KNOWN_CREDENTIAL_ISSUER)) {
      return (fetch as (input: unknown, init?: RequestInit) => Promise<Response>)(input, init)
    }

    const headers = new Headers(init?.headers)
    headers.set('Accept', 'application/jwt, application/json')

    return (fetch as (input: unknown, init?: RequestInit) => Promise<Response>)(input, { ...init, headers })
  }) as typeof agentDependencies.fetch
}

const agentDependenciesWithSignedMetadata = {
  ...agentDependencies,
  fetch: withSignedIssuerMetadataAccept(agentDependencies.fetch),
}

/**
 * Trust anchors for verifying an issuer's *signed* credential-issuer metadata JWT.
 *
 * THE GATE for offer-time issuer trust: the metadata JWT's x5c chain must validate against the
 * certificate ZADA published for that issuer in the trust registry. Returning the registry
 * certificate here is what binds the signing key to the registry entry — the difference between a
 * real trust badge and a decorative one.
 *
 * Falls back to `undefined` when the issuer isn't in the ZADA registry, which makes credo use the
 * agent's configured trusted certificates (the hardcoded EU / paradym anchors) — so non-ZADA
 * issuers that sign their metadata keep working exactly as before. This widens no trust: an issuer
 * that is in neither set still fails verification.
 */
const getTrustedCertificatesForSignedIssuerMetadata = async (credentialIssuer?: string) => {
  const anchors = await getZadaRegistryAnchorsForIssuer(credentialIssuer)
  return anchors.length > 0 ? (anchors as [string, ...string[]]) : undefined
}

export const initializeEasyPIDAgent = async ({
  walletId,
  walletKey,
  keyDerivation,
  trustedX509Certificates,
}: {
  walletId: string
  walletKey: string
  keyDerivation: 'raw' | 'derive'
  trustedX509Certificates: string[]
}) => {
  const agent = new Agent({
    dependencies: agentDependenciesWithSignedMetadata,
    config: {
      autoUpdateStorageOnStartup: true,
      logger,
    },
    modules: {
      askar: new AskarModule({
        askar,
        // We register it manually to set default / determine order
        // FIXME: we should not require enableKms to be set to false
        // but just not re-register
        enableKms: false,
        store: {
          id: walletId,
          key: walletKey,
          keyDerivationMethod: keyDerivation === 'raw' ? 'raw' : 'kdf:argon2i:mod',
        },
      }),
      kms: new Kms.KeyManagementModule({
        backends: [new AskarKeyManagementService(), new SecureEnvironmentKeyManagementService()],
        defaultBackend: 'askar',
      }),
      openid4vc: new OpenId4VcModule({}),
      x509: new X509Module({
        getTrustedCertificatesForVerification: async (_agentContext, { certificateChain, verification }) => {
          // Offer-time issuer trust: only the certificate ZADA published for this issuer may verify
          // its signed metadata, so a valid signature proves the signer IS the registered issuer.
          if (verification.type === 'openId4VciCredentialIssuerMetadata') {
            return getTrustedCertificatesForSignedIssuerMetadata(verification.credentialIssuerMetadata.payload.sub)
          }

          if (verification.type === 'credential') {
            // Temporarily allow any certificates, also for PID
            // Only allow BDR certificate for PID credentials for now
            // if (
            //   verification.credential instanceof Mdoc &&
            //   pidSchemes.msoMdocDoctypes.includes(verification.credential.docType)
            // ) {
            //   return [bdrPidIssuerCertificate]
            // }

            // if (
            //   verification.credential.claimFormat === ClaimFormat.SdJwtDc &&
            //   pidSchemes.sdJwtVcVcts.includes(verification.credential.payload.vct as string)
            // ) {
            //   return [bdrPidIssuerCertificate]
            // }

            // If not PID, we allow any certificate for now
            return [certificateChain[certificateChain.length - 1].toString('pem')]
          }

          // Allow any actor for auth requests for now
          if (verification.type === 'oauth2SecuredAuthorizationRequest') {
            return [certificateChain[certificateChain.length - 1].toString('pem')]
          }

          return undefined
        },
        trustedCertificates:
          trustedX509Certificates.length > 0 ? (trustedX509Certificates as [string, ...string[]]) : undefined,
      }),
    },
  })

  await agent.initialize()

  return agent
}

export const initializeParadymAgent = async ({
  walletId,
  walletKey,
  keyDerivation,
  trustedX509Certificates = [],
}: {
  walletId: string
  walletKey: string
  keyDerivation: 'raw' | 'derive'
  trustedX509Certificates?: string[]
}) => {
  const agent = new Agent({
    dependencies: agentDependenciesWithSignedMetadata,
    config: {
      autoUpdateStorageOnStartup: true,
      logger,
    },
    modules: {
      askar: new AskarModule({
        askar,
        store: {
          id: walletId,
          key: walletKey,
          keyDerivationMethod: keyDerivation === 'raw' ? 'raw' : 'kdf:argon2i:mod',
        },
      }),
      openid4vc: new OpenId4VcModule({}),
      x509: new X509Module({
        getTrustedCertificatesForVerification: async (_, { certificateChain, verification }) => {
          // Offer-time issuer trust: only the certificate ZADA published for this issuer may verify
          // its signed metadata, so a valid signature proves the signer IS the registered issuer.
          if (verification.type === 'openId4VciCredentialIssuerMetadata') {
            return getTrustedCertificatesForSignedIssuerMetadata(verification.credentialIssuerMetadata.payload.sub)
          }

          if (verification.type === 'credential') {
            // If not PID, we allow any certificate for now
            return [certificateChain[certificateChain.length - 1].toString('pem')]
          }

          // Allow any actor for auth requests for now
          if (verification.type === 'oauth2SecuredAuthorizationRequest') {
            return [certificateChain[certificateChain.length - 1].toString('pem')]
          }

          return undefined
        },
        trustedCertificates:
          trustedX509Certificates.length > 0 ? (trustedX509Certificates as [string, ...string[]]) : undefined,
      }),
      dids: new DidsModule({
        registrars: [new KeyDidRegistrar(), new JwkDidRegistrar()],
        resolvers: [new WebDidResolver(), new KeyDidResolver(), new JwkDidResolver(), new CheqdDidResolver()],
      }),
      didcomm: new DidCommModule({
        transports: {
          outbound: [new DidCommHttpOutboundTransport(), new DidCommWsOutboundTransport()],
        },
        connections: {
          autoAcceptConnections: true,
          peerNumAlgoForDidExchangeRequests: PeerDidNumAlgo.GenesisDoc,
        },
        mediationRecipient: {
          // We want to manually connect to the mediator, so it doesn't impact wallet startup
          mediatorPickupStrategy: DidCommMediatorPickupStrategy.None,
        },
        credentials: {
          autoAcceptCredentials: DidCommAutoAcceptCredential.ContentApproved,
          credentialProtocols: [
            new DidCommCredentialV1Protocol({
              indyCredentialFormat: new LegacyIndyDidCommCredentialFormatService(),
            }),
            new DidCommCredentialV2Protocol({
              credentialFormats: [
                new LegacyIndyDidCommCredentialFormatService(),
                new AnonCredsDidCommCredentialFormatService(),
              ],
            }),
          ],
        },
        proofs: {
          autoAcceptProofs: DidCommAutoAcceptProof.ContentApproved,
          proofProtocols: [
            new DidCommProofV1Protocol({
              indyProofFormat: new LegacyIndyDidCommProofFormatService(),
            }),
            new DidCommProofV2Protocol({
              proofFormats: [new LegacyIndyDidCommProofFormatService(), new AnonCredsDidCommProofFormatService()],
            }),
          ],
        },

        messagePickup: true,

        // We don't support messaging/mediator
        // basicMessages: false,
        // mediator: false,
      }),

      anoncreds: new AnonCredsModule({
        registries: [new CheqdAnonCredsRegistry(), new DidWebAnonCredsRegistry()],
        anoncreds,
      }),
      cheqd: new CheqdModule(
        new CheqdModuleConfig({
          networks: [
            {
              network: 'testnet',
            },
            {
              network: 'mainnet',
            },
          ],
        })
      ),
    },
  })

  await agent.initialize()

  return agent
}

export type ParadymAppAgent = Awaited<ReturnType<typeof initializeParadymAgent>>
export type EasyPIDAppAgent = Awaited<ReturnType<typeof initializeEasyPIDAgent>>
export type EitherAgent = ParadymAppAgent | EasyPIDAppAgent

export const isParadymAgent = (agent: EitherAgent): agent is ParadymAppAgent => {
  return 'anoncreds' in agent.modules
}

export const isEasyPIDAgent = (agent: EitherAgent): agent is EasyPIDAppAgent => {
  return !('anoncreds' in agent.modules)
}
