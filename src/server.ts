import express, { Request, Response } from 'express';
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
  HttpOutboundTransport,
  WsOutboundTransport 
} from '@credo-ts/core';
import { HttpInboundTransport } from '@credo-ts/node';
import agent from './agent_setup';

dotenv.config();

const PORT = process.env.PORT || 3000;
const ENDORSER_DID = process.env.ENDORSER_DID || '';
const SEED = process.env.SEED || '';

// Initialisiere Agent
agent.registerOutboundTransport(new HttpOutboundTransport());
agent.registerOutboundTransport(new WsOutboundTransport());
agent.registerInboundTransport(new HttpInboundTransport({ port: Number(PORT) }));

// Verbindungen speichern
const activeConnections: { [id: string]: { state: string, connectionRecord: any } } = {};

// Funktion zur Initialisierung des Agenten und Import der DID
async function initializeAgent() {
  try {
    await agent.initialize();
    console.log('Agent erfolgreich initialisiert!');

    const existingDIDs = await agent.dids.getCreatedDids();
    if (existingDIDs.length === 0) {
      await importDID();
    }

    console.log('Erstellte DIDs:', existingDIDs);
  } catch (error) {
    console.error('Fehler beim Initialisieren des Agenten:', error);
  }
}

// Funktion: Importiere eine DID
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

// Funktion: Erstelle eine neue Einladung
async function createInvitation() {
  try {
    const outOfBandRecord = await agent.oob.createInvitation();

    return {
      invitationUrl: outOfBandRecord.outOfBandInvitation.toUrl({
        domain: 'https://9f29-2003-e9-370d-f00-8449-df89-c04a-9340.ngrok-free.app', // Ersetze durch deine Domain
      }),
      outOfBandRecord,
    };
  } catch (error) {
    console.error('Fehler beim Erstellen der Einladung:', error);
    throw error;
  }
}

// Funktion: Verbindungen überwachen
function setupConnectionListener(agent: Agent) {
  agent.events.on<ConnectionStateChangedEvent>(ConnectionEventTypes.ConnectionStateChanged, ({ payload }) => {
    const connectionId = payload.connectionRecord.id;
    activeConnections[connectionId] = {
      state: payload.connectionRecord.state,
      connectionRecord: payload.connectionRecord,
    };

    console.log(`Verbindung aktualisiert: ID=${connectionId}, State=${payload.connectionRecord.state}`);

    if (payload.connectionRecord.state === DidExchangeState.Completed) {
      console.log(`Verbindung abgeschlossen: ID=${connectionId}`);
    }
  });
}

// Initialisiere Agent und überwache Verbindungen
initializeAgent();
setupConnectionListener(agent);

// Express-App erstellen
const app = express();

// Middleware
app.use(express.json());
app.use(cors({ origin: 'http://localhost:4000', methods: ['GET', 'POST'], allowedHeaders: ['Content-Type'] }));

// Endpunkt: Basis-Check
app.get('/', (req: Request, res: Response) => {
  res.send('Server läuft!');
});

// Endpunkt: Einladung erstellen
app.get('/create-invitation', async (req: Request, res: Response) => {
  try {
    const invitation = await createInvitation();
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
