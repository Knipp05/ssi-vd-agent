import express, { Request, Response, Router } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { 
  Agent, 
  OutOfBandRecord, 
  ConnectionEventTypes, 
  ConnectionStateChangedEvent, 
  DidExchangeState, 
  KeyType, 
  TypedArrayEncoder,
  JwaSignatureAlgorithm
} from '@credo-ts/core';
import { initializeAgent } from './agent_setup.js';
import { OpenId4VcIssuanceSessionStateChangedEvent, OpenId4VcIssuerEvents } from '@credo-ts/openid4vc';

dotenv.config();

const PORT = process.env.PORT || 3000;
const ENDORSER_DID = process.env.ENDORSER_DID || '';
const SEED = process.env.SEED || '';

// Verbindungen speichern
const activeConnections: { [id: string]: { state: string, connectionRecord: any } } = {};

// Funktion: Erstelle eine neue Einladung
const createNewInvitation = async (agent: Agent) => {
  const outOfBandRecord = await agent.oob.createInvitation()

  return {
        
    invitationUrl: outOfBandRecord.outOfBandInvitation.toUrl({domain: 'https://9f29-2003-e9-370d-f00-8449-df89-c04a-9340.ngrok-free.app' }),
    outOfBandRecord
  }
}

// Funktion: Verbindungen überwachen


const verifierRouter = Router()
const issuerRouter = Router()

const agent = await initializeAgent(issuerRouter, verifierRouter)

/* const schemaResult = await agent.modules.anoncreds.registerSchema({
  schema: {
    attrNames: ['name'],
    issuerId: ENDORSER_DID,
    name: 'Example Schema to register',
    version: '1.0.0',
  },
  options: {},
})

if (schemaResult.schemaState.state === 'failed') {
  throw new Error(`Error creating schema: ${schemaResult.schemaState.reason}`)
}

const credentialDefinitionResult = await agent.modules.anoncreds.registerCredentialDefinition({
  credentialDefinition: {
    tag: 'default',
    issuerId: ENDORSER_DID,
    schemaId: schemaResult.schemaState.schemaId || '',
  },
  options: {
    supportRevocation: false,
  },
})

if (credentialDefinitionResult.credentialDefinitionState.state === 'failed') {
  throw new Error(
    `Error creating credential definition: ${credentialDefinitionResult.credentialDefinitionState.reason}`
  )
} */

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

agent.events.on<OpenId4VcIssuanceSessionStateChangedEvent>(OpenId4VcIssuerEvents.IssuanceSessionStateChanged, (event) => {
  if (event.payload.issuanceSession.id === issuanceSession.id) {
    // the connection is now ready for usage in other protocols!
    console.log(`Issuance session state changed to `, event.payload.issuanceSession.state)

    // Custom business logic can be included here
    // In this example we can send a basic message to the connection, but
    // anything is possible

    // We exit the flow
  }
})

// Express-App erstellen
const app = express();
// Middleware
app.use(express.json());
app.use(cors({ origin: 'http://localhost:4000', methods: ['GET', 'POST'], allowedHeaders: ['Content-Type'] }));

app.use('/oid4vci', issuerRouter)
app.use('/siop', verifierRouter)

// Endpunkt: Basis-Check
issuerRouter.get('/', (req: Request, res: Response) => {
  res.send('Server läuft!');
});

// Endpunkt: Einladung erstellen
issuerRouter.get('/create-invitation', async (req: Request, res: Response) => {
  try {
    const invitation = await createNewInvitation(agent);
    res.status(200).json(invitation);
  } catch (error) {
    res.status(500).json({ error: 'Fehler beim Erstellen der Einladung' });
  }
});

// Endpunkt: Aktive Verbindungen abrufen
app.get('/connections', async (req: Request, res: Response) => {
  try {
    res.status(200).json(activeConnections);
  } catch (error) {
    res.status(500).json({ error: 'Fehler beim Abrufen der Verbindungen' });
  }
});

// Endpunkt: DID erstellen
app.post('/create-did', async (req: Request, res: Response) => {
  try {
    const didResult = await agent.dids.create({
      method: 'indy',
      options: {
        network: 'bcovrin:test',
        endorserDid: ENDORSER_DID,
        endorserMode: 'internal',
      },
    });
    res.status(201).json(didResult);
  } catch (error) {
    console.error('Fehler beim Erstellen der DID:', error);
    res.status(500).json({ error: 'Fehler beim Erstellen der DID' });
  }
});

// Endpunkt: VC ausstellen
app.post('/issue-credential', async (req: Request, res: Response) => {
  try {
    const { connectionId, attributes } = req.body;
    if (!connectionId || !attributes) {
      return res.status(400).json({ error: 'connectionId und attributes erforderlich' });
    }

    const credential = await agent.credentials.offerCredential({
      protocolVersion: 'v2',
      connectionId,
      credentialFormats: {
        anoncreds: {
          credentialDefinitionId: '<CREDENTIAL_DEFINITION_ID>', // Ersetze mit der Credential Definition ID
          attributes,
        },
      },
    });

    console.log(credential)

    res.status(201).json(credential);
  } catch (error) {
    console.error('Fehler beim Ausstellen des Credentials:', error);
    res.status(500).json({ error: 'Fehler beim Ausstellen des Credentials' });
  }
});

// Server starten
app.listen(PORT, () => {
  console.log(`Server läuft auf http://localhost:${PORT}`);
});
