import { InitConfig, Agent, DidsModule, CredentialsModule, V2CredentialProtocol, JwaSignatureAlgorithm, KeyDidCreateOptions, KeyType, TypedArrayEncoder } from '@credo-ts/core';
import { agentDependencies } from '@credo-ts/node';
import { AskarModule } from '@credo-ts/askar';
import { ariesAskar } from '@hyperledger/aries-askar-nodejs';
import { IndyVdrAnonCredsRegistry, IndyVdrIndyDidRegistrar, IndyVdrIndyDidResolver, IndyVdrModule } from '@credo-ts/indy-vdr';
import { indyVdr } from '@hyperledger/indy-vdr-nodejs';
import fs from 'fs';
import { anoncreds } from '@hyperledger/anoncreds-nodejs';
import { AnonCredsCredentialFormatService, AnonCredsModule, LegacyIndyCredentialFormatService } from '@credo-ts/anoncreds';
import { OpenId4VcIssuanceSessionStateChangedEvent, OpenId4VcIssuerEvents, OpenId4VcIssuerModule, OpenId4VcVerifierModule } from '@credo-ts/openid4vc';
import express, { Router } from 'express'
import dotenv from 'dotenv';

dotenv.config();

const PORT = process.env.PORT || 3000;
const ENDORSER_DID = process.env.ENDORSER_DID || '';
const SEED = process.env.SEED || '';

const genesisTransactions = fs.readFileSync('./bcovrin_genesis.txn', 'utf8');

const config: InitConfig = {
  label: 'SSI Prototype',
  walletConfig: {
    id: 'my-wallet',
    key: 'secure-wallet-key-123456',
  }
};

const verifierRouter = Router()
const issuerRouter = Router()

const app = express()
app.use('/oid4vci', issuerRouter)
app.use('/siop', verifierRouter)

async function importDID() {
  try {
    const mySeed = TypedArrayEncoder.fromString(SEED);

    await agent.dids.import({
      did: ENDORSER_DID,
      privateKeys: [
        {
          keyType: KeyType.Ed25519,
          privateKey: mySeed,
        },
      ],
      overwrite: true,
    });

    console.log('DID erfolgreich importiert!');
  } catch (error) {
    console.error('Fehler beim Importieren des DID:', error);
  }
}

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
          credentialRequestToCredentialMapper: async () => {
            throw new Error('Not implemented')
          }
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

await agent.initialize();
console.log('Agent erfolgreich initialisiert!');

const existingDIDs = await agent.dids.getCreatedDids();
  if (existingDIDs.length === 0) {
    await importDID();
  }
console.log('Erstellte DIDs:', existingDIDs);

const openid4vcIssuer = await agent.modules.openId4VcIssuer.createIssuer({
  display: [
    {
      name: 'Test Issuer',
      description: 'This is my SSI Prototype test issuer',
      text_color: '#000000',
      background_color: '#FFFFFF',
    }
  ],
  credentialsSupported: [
    {
      format: 'vc+sd-jwt',
      vct: 'Test Issuer',
      id: 'Test Issuer',
      cryptographic_binding_methods_supported: ['did:indy'],
      cryptographic_suites_supported: [JwaSignatureAlgorithm.ES256]
    }
  ]
})

const { credentialOffer, issuanceSession } = await agent.modules.openId4VcIssuer.createCredentialOffer({
  issuerId: openid4vcIssuer.issuerId,
  offeredCredentials: ['Test Issuer'],
  preAuthorizedCodeFlowConfig: {
    userPinRequired: false
  },
})

agent.events.on<OpenId4VcIssuanceSessionStateChangedEvent>(
  OpenId4VcIssuerEvents.IssuanceSessionStateChanged,
  (event) => {
    if (event.payload.issuanceSession.id === issuanceSession.id) {
      console.log('Issuance session state changed to ', event.payload.issuanceSession.state)
    }
  }
)

app.listen(3000, () => {
  console.log(`Server läuft auf http://localhost:3000`)
})

export default agent;
