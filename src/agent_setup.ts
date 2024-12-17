import { InitConfig, Agent, DidsModule, KeyType, TypedArrayEncoder, CredentialsModule, V2CredentialProtocol, W3cCredentialSchema, W3cJsonLdVerifiableCredential, W3cCredential } from '@credo-ts/core';
import { agentDependencies } from '@credo-ts/node';
import { HttpOutboundTransport, WsOutboundTransport } from '@credo-ts/core';
import { HttpInboundTransport } from '@credo-ts/node';
import { AskarModule } from '@credo-ts/askar';
import { ariesAskar } from '@hyperledger/aries-askar-nodejs';
import { IndyVdrIndyDidRegistrar, IndyVdrIndyDidResolver, IndyVdrModule } from '@credo-ts/indy-vdr';
import { indyVdr } from '@hyperledger/indy-vdr-nodejs';
import fs from 'fs';
import * as dotenv from 'dotenv'
import { W3cJsonLdCredentialService } from '@credo-ts/core/build/modules/vc/data-integrity/W3cJsonLdCredentialService';

dotenv.config();

const seed = process.env.SEED || ''
const endorserDID = process.env.ENDORSER_DID || ''

const genesisTransactions = fs.readFileSync('./bcovrin_genesis.txn', 'utf8');

const config: InitConfig = {
  label: 'bcovrin-agent',
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
    credentials: new CredentialsModule({
      credentialProtocols: [
        new V2CredentialProtocol({
          credentialFormats: []
        })
      ]
    })
  },
});

agent.registerOutboundTransport(new HttpOutboundTransport());
agent.registerOutboundTransport(new WsOutboundTransport());
agent.registerInboundTransport(new HttpInboundTransport({ port: 3000 }));

async function importDID() {
  try {
    // Seed (32 Bytes)
    const mySeed = TypedArrayEncoder.fromString(seed);

    // Importiere den DID und den Private Key in den Agenten
    await agent.dids.import({
      did: endorserDID,
      privateKeys: [
        {
          keyType: KeyType.Ed25519,
          privateKey: mySeed,
        },
      ],
      overwrite: true
    });

    console.log('DID erfolgreich importiert!');

    // Überprüfe, ob der DID importiert wurde
    const createdDids = await agent.dids.getCreatedDids();
    console.log('Erstellte DIDs:', createdDids);
  } catch (error) {
    console.error('Fehler beim Importieren des DIDs:', error);
  }
}

agent
  .initialize()
  .then(() => {
    console.log('Agent erfolgreich initialisiert!', importDID());
  })
  .catch((e) => {
    console.error('Fehler beim Initialisieren des Agents:', e);
  });

export default agent;
