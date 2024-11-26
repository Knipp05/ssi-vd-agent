import { InitConfig, Agent, DidsModule, KeyType, TypedArrayEncoder } from '@credo-ts/core';
import { agentDependencies } from '@credo-ts/node';
import { HttpOutboundTransport, WsOutboundTransport } from '@credo-ts/core';
import { HttpInboundTransport } from '@credo-ts/node';
import { AskarModule } from '@credo-ts/askar';
import { ariesAskar } from '@hyperledger/aries-askar-nodejs';
import { IndyVdrIndyDidRegistrar, IndyVdrIndyDidResolver, IndyVdrModule } from '@credo-ts/indy-vdr';
import { indyVdr } from '@hyperledger/indy-vdr-nodejs';
import nacl from 'tweetnacl'

import fs from 'fs';

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
  },
});

agent.registerOutboundTransport(new HttpOutboundTransport());
agent.registerOutboundTransport(new WsOutboundTransport());
agent.registerInboundTransport(new HttpInboundTransport({ port: 3000 }));

async function importDID() {
  try {
    // Seed (32 Bytes)
    const mySeed = TypedArrayEncoder.fromString('12345678912345678912345678912345');

    // Generiere das Schlüsselpaar
    const keyPair = nacl.sign.keyPair.fromSeed(mySeed);

    // Extrahiere den tatsächlichen Private Key (32 Bytes)
    const privateKey = keyPair.secretKey.slice(0, 32);

    // Base64-kodierten Schlüssel prüfen und dekodieren (falls nötig)
    const privateKeyBase64 = btoa(String.fromCharCode(...privateKey)); // In Base64 kodiert
    console.log('Private Key (Base64):', privateKeyBase64);

    // Importiere den DID und den Private Key in den Agenten
    await agent.dids.import({
      did: 'did:indy:bcovrin:test:W38HfXFqhWKGEu1NH6YhPz',
      privateKeys: [
        {
          keyType: KeyType.Ed25519,
          privateKey: TypedArrayEncoder.fromBase64(privateKeyBase64),
        },
      ],
      overwrite: true
    });

    console.log('DID erfolgreich importiert!');

    // Überprüfe, ob der DID importiert wurde
    const createdDids = await agent.dids.getCreatedDids();
    //console.log('Erstellte DIDs:', createdDids);

    const result = await agent.dids.resolve('did:indy:bcovrin:test:W38HfXFqhWKGEu1NH6YhPz')
    console.log(result)
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
