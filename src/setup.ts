// Core interfaces
import {
  createAgent,
  IDIDManager,
  IResolver,
  IDataStore,
  IDataStoreORM,
  IKeyManager,
  ICredentialPlugin,
} from '@veramo/core'

// Core identity manager plugin
import { DIDManager } from '@veramo/did-manager'

// Ethr did identity provider
import { EthrDIDProvider } from '@veramo/did-provider-ethr'

// Core key manager plugin
import { KeyManager } from '@veramo/key-manager'

// Custom key management system for RN
import { KeyManagementSystem, SecretBox } from '@veramo/kms-local'

// W3C Verifiable Credential plugin
import { CredentialPlugin } from '@veramo/credential-w3c'

import { CredentialIssuerLD, LdDefaultContexts } from '@veramo/credential-ld';
// Custom resolvers
import { DIDResolverPlugin } from '@veramo/did-resolver'
import { Resolver } from 'did-resolver'
import { getResolver as ethrDidResolver } from 'ethr-did-resolver'

// Storage plugin using TypeOrm
import { Entities, KeyStore, DIDStore, PrivateKeyStore, migrations } from '@veramo/data-store'

// TypeORM is installed with `@veramo/data-store`
import { Column, DataSource, Entity, PrimaryGeneratedColumn } from 'typeorm'
import 'reflect-metadata';

// This will be the name for the local sqlite database for demo purposes
const DATABASE_FILE = 'database.sqlite'

// You will need to get a project ID from infura https://www.infura.io
const INFURA_PROJECT_ID = 'ab68bdc6be4042ae95da0025f1d9a8bc'

// This will be the secret key for the KMS (replace this with your secret key)
const KMS_SECRET_KEY =
'43580ae143b86c9f0445cad13537be9876910cf1668624716c1c2b9b698b6945'

@Entity()
export class DIDEntity {
@PrimaryGeneratedColumn()
id!: number;

@Column()
did!: string;
}

const dbConnection = new DataSource({
type: 'sqlite',
database: DATABASE_FILE,
synchronize: true, //später deaktivieren
migrations,
migrationsRun: true,
logging: ['error', 'info', 'warn'],
entities: [DIDEntity, ...Entities],
}).initialize()

export async function getOrCreateDID() {
const repository = (await dbConnection).getRepository(DIDEntity);

// Prüfen, ob eine DID existiert
const existingDID = await repository.findOneBy({}); // Ohne Bedingungen sucht es den ersten Eintrag
if (existingDID) {
  console.log('Existing DID found:', existingDID.did);
  return existingDID.did;
}

// Neue DID erstellen
const newDID = await agent.didManagerCreate({ provider: 'did:ethr:sepolia' });
await repository.save({ did: newDID.did });
console.log('New DID created and saved:', newDID.did);

return newDID.did;
}

export const agent = createAgent<
IDIDManager & IKeyManager & IDataStore & IDataStoreORM & IResolver & ICredentialPlugin
>({
plugins: [
  new KeyManager({
    store: new KeyStore(dbConnection),
    kms: {
      local: new KeyManagementSystem(new PrivateKeyStore(dbConnection, new SecretBox(KMS_SECRET_KEY))),
    },
  }),
  new DIDManager({
    store: new DIDStore(dbConnection),
    defaultProvider: 'did:ethr:sepolia',
    providers: {
      'did:ethr:sepolia': new EthrDIDProvider({
        defaultKms: 'local',
        network: 'sepolia',
        rpcUrl: 'https://sepolia.infura.io/v3/' + INFURA_PROJECT_ID,
      }),
    },
  }),
  new DIDResolverPlugin({
    resolver: new Resolver({
      ...ethrDidResolver({ infuraProjectId: INFURA_PROJECT_ID })
    }),
  }),
  new CredentialPlugin(),
],
})