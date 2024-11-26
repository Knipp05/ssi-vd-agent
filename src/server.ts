import { IndyVdrDidCreateOptions } from '@credo-ts/indy-vdr';
import agent from './agent_setup';
import express, { Request, Response } from 'express';

// EbCwTjMzufirq79KkiwdES - Endorser DID Namespace-Identifier
// ~Rv6XsWnsnxxJ3RqcanZfKW - Verkey

async function createLocalDid() {
  const didResult = await agent.dids.create<IndyVdrDidCreateOptions>({
    method: 'indy',
    options: {
      alias: undefined,
      role: undefined,
      services: undefined,
      useEndpointAttrib: undefined,
      verkey: undefined,
      endorserDid: 'did:indy:bcovrin:test:EbCwTjMzufirq79KkiwdES',
      endorserMode: 'internal',
      endorsedTransaction: undefined
    }
  });
  console.log('Lokale DID erstellt:', didResult);
  return didResult;
}

  // Erstelle eine Instanz der Express-Anwendung
  const app = express();
  const PORT = 3000;
  
  // Middleware zum Parsen von JSON-Requests
  app.use(express.json());
  
  // Basis-Endpunkt: Prüft, ob der Server läuft
  app.get('/', (req: Request, res: Response) => {
    res.send('Server is running');
  });
  
  // Beispiel-Endpunkt: Eine DID erstellen
  app.post('/create-did', async (req: Request, res: Response) => {
    try {
      // Beispiel für eine Aktion (z. B. DID-Erstellung)
      const exampleDid = createLocalDid(); // Ersetze dies mit der Logik deines Agenten
      res.status(201).json({ did: exampleDid });
    } catch (error) {
      console.error('Error creating DID:', error);
      res.status(500).json({ error: 'Failed to create DID' });
    }
  });
  
  // Beispiel-Endpunkt: DID auflösen
  app.get('/resolve-did', async (req: Request, res: Response) => {
    try {
      const { did } = req.query; // DID aus Query-Parametern abrufen
      if (!did) {
        return res.status(400).json({ error: 'DID is required' });
      }
  
      // Beispiel für eine Aktion (z. B. DID-Auflösung)
      const resolvedDid = { id: did, status: 'resolved' }; // Ersetze dies mit der Logik deines Agenten
      res.status(200).json(resolvedDid);
    } catch (error) {
      console.error('Error resolving DID:', error);
      res.status(500).json({ error: 'Failed to resolve DID' });
    }
  });
  
  // Beispiel-Endpunkt: Eine Nachricht senden
  app.post('/send-message', async (req: Request, res: Response) => {
    try {
      const { to, message } = req.body; // Nachrichtendaten aus der Anfrage
      if (!to || !message) {
        return res.status(400).json({ error: 'Recipient and message are required' });
      }
  
      // Beispiel für das Senden einer Nachricht
      const messageId = 'msg-123456'; // Ersetze dies mit der Logik deines Agenten
      res.status(200).json({ messageId, status: 'sent' });
    } catch (error) {
      console.error('Error sending message:', error);
      res.status(500).json({ error: 'Failed to send message' });
    }
  });
  
  // Starte den Server
  app.listen(PORT, () => {
    console.log(`Server läuft auf http://localhost:${PORT}`);
  });
  