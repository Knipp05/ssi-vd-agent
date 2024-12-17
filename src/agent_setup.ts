import { InitConfig, Agent, DidsModule, CredentialsModule, V2CredentialProtocol, JwaSignatureAlgorithm, KeyDidCreateOptions, KeyType, TypedArrayEncoder, WsOutboundTransport, HttpOutboundTransport, ConnectionEventTypes, ConnectionStateChangedEvent, DidExchangeState, OutOfBandRecord, ConnectionsModule, DidKey, DidsApi } from '@credo-ts/core';
import { agentDependencies, HttpInboundTransport } from '@credo-ts/node';
import { AskarModule } from '@credo-ts/askar';
import { ariesAskar } from '@hyperledger/aries-askar-nodejs';
import { IndyVdrAnonCredsRegistry, IndyVdrIndyDidRegistrar, IndyVdrIndyDidResolver, IndyVdrModule } from '@credo-ts/indy-vdr';
import { indyVdr } from '@hyperledger/indy-vdr-nodejs';
import fs from 'fs';
import { anoncreds } from '@hyperledger/anoncreds-nodejs';
import { AnonCredsCredentialFormatService, AnonCredsModule, LegacyIndyCredentialFormatService } from '@credo-ts/anoncreds';
import { OpenId4VciCredentialFormatProfile, OpenId4VciCredentialConfigurationsSupported, OpenId4VcIssuanceSessionStateChangedEvent, OpenId4VcIssuerEvents, OpenId4VcIssuerModule, OpenId4VcVerifierModule, OpenId4VciCredentialRequestToCredentialMapper } from '@credo-ts/openid4vc';
import express, { Router } from 'express'

const genesisTransactions = fs.readFileSync('./bcovrin_genesis.txn', 'utf8');

const credentialRequestToCredentialMapperFunc: OpenId4VciCredentialRequestToCredentialMapper = async ({
  // agent context for the current wallet / tenant
  agentContext,
  // the credential offer related to the credential request
  credentialOffer,
  // the received credential request
  credentialRequest,
  // the list of credentialsSupported entries
  credentialsSupported,
  // the cryptographic binding provided by the holder in the credential request proof
  holderBinding,
  // the issuance session associated with the credential request and offer
  issuanceSession,
}) => {
  const firstSupported = credentialsSupported[0]

  // We only support vc+sd-jwt in this example, but you can add more formats
  if (firstSupported.format !== OpenId4VciCredentialFormatProfile.SdJwtVc) {
    throw new Error('Only vc+sd-jwt is supported')
  }

  // We only support AcmeCorpEmployee in this example, but you can support any type
  if (firstSupported.vct !== 'AcmeCorpEmployee') {
    throw new Error('Only AcmeCorpEmployee is supported')
  }

  // find the first did:key did in our wallet. You can modify this based on your needs
  const didsApi = agentContext.dependencyManager.resolve(DidsApi)
  const [didKeyDidRecord] = await didsApi.getCreatedDids({
    method: 'key',
  })

  const didKey = DidKey.fromDid(didKeyDidRecord.did)
  const didUrl = `${didKey.did}#${didKey.key.fingerprint}`

  return {
    credentialSupportedId: firstSupported.id || '',
    format: 'vc+sd-jwt',
    // We can provide the holderBinding as is, if we don't want to make changes
    holder: holderBinding,
    payload: {
      vct: firstSupported.vct,
      firstName: 'John',
      lastName: 'Doe',
    },
    disclosureFrame: {
      _sd: ['lastName'],
    },
    issuer: {
      method: 'did',
      didUrl,
    },
  }
}

 export const initializeAgent = async (issuerRouter: Router, verifierRouter: Router) => {
  const config: InitConfig = {
    label: 'SSI Prototype',
    walletConfig: {
      id: 'my-wallet',
      key: 'secure-wallet-key-123456',
    }
  };

  const agent = new Agent({
    config,
    dependencies: agentDependencies,
    modules: {
      dids: new DidsModule({
        registrars: [new IndyVdrIndyDidRegistrar()],
        resolvers: [new IndyVdrIndyDidResolver()],
      }),
      askar: new AskarModule({
        ariesAskar, 
      }),
      connections: new ConnectionsModule({ autoAcceptConnections: true }),
      indyVdr: new IndyVdrModule({
        indyVdr,
        networks: [
          {
            indyNamespace: 'bcovrin:test',
            genesisTransactions: genesisTransactions,
            isProduction: false,
            connectOnStartup: true,
          },
        ],
      }),
      openId4VcIssuer: new OpenId4VcIssuerModule({
        baseUrl: 'http://127.0.0.1:3000/oid4vci',
        router: issuerRouter,
        endpoints: {
          credential: {
            credentialRequestToCredentialMapper: credentialRequestToCredentialMapperFunc        
          }
        }
      }),
      openId4VcVerifier: new OpenId4VcVerifierModule({
        baseUrl: 'http://127.0.0.1:3000/siop',
        router: verifierRouter,
      }),
      credentials: new CredentialsModule({
        credentialProtocols: [
          new V2CredentialProtocol({
            credentialFormats: [new LegacyIndyCredentialFormatService(), new AnonCredsCredentialFormatService()]
          })
        ]
      }),
      anoncreds: new AnonCredsModule({
        registries: [new IndyVdrAnonCredsRegistry()],
        anoncreds
      })
    },
  });

  agent.registerOutboundTransport(new WsOutboundTransport())
  agent.registerOutboundTransport(new HttpOutboundTransport())
  agent.registerInboundTransport(new HttpInboundTransport({ port: 3000 }))

  await agent.initialize()

  return agent
}

export const credentialConfigurationsSupported = {
  PresentationAuthorization: {
    format: OpenId4VciCredentialFormatProfile.SdJwtVc,
    vct: 'PresentationAuthorization',
    scope: 'openid4vc:credential:PresentationAuthorization',
    cryptographic_binding_methods_supported: ['jwk', 'did:key', 'did:jwk', 'did:indy'],
    credential_signing_alg_values_supported: ['ES256', 'EdDSA'],
  },
  'UniversityDegreeCredential-sdjwt': {
    format: OpenId4VciCredentialFormatProfile.SdJwtVc,
    vct: 'UniversityDegreeCredential',
    scope: 'openid4vc:credential:OpenBadgeCredential-sdjwt',
    cryptographic_binding_methods_supported: ['jwk'],
    credential_signing_alg_values_supported: ['ES256', 'EdDSA'],
  },
} satisfies OpenId4VciCredentialConfigurationsSupported
