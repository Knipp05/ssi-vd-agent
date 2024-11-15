import express from 'express'
import { agent, getOrCreateDID } from './setup.js'; // Importiere den Agenten aus setup.ts

const ISSUER_DID = await getOrCreateDID();

const app = express();
const PORT = 3000;

// Middleware, um JSON-Requests zu parsen
app.use(express.json());

app.get('/', (req, res) => {
  res.send('Server is running');
})

// Beispielroute zur Verifizierung eines Credentials
app.post('/verify-credential', async (req, res) => {
  try {
    const { credential } = req.body;
    const result = await agent.verifyCredential({ credential });
    res.json(result);
  } catch (error) {
    if (error instanceof Error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }
});

// Beispielroute zum Ausstellen eines Credentials
app.post('/issue-credential', async (req, res) => {
  try {
    const { subject, claims } = req.body;

    // Generiere ein Verifiable Credential
    const credential = await agent.createVerifiableCredential({
      credential: {
        issuer: { id: ISSUER_DID },
        subject,
        type: ['VerifiableCredential'],
        issuanceDate: new Date().toISOString(),
        credentialSubject: {
          id: subject,
          ...claims,
        },
        '@context': ['https://www.w3.org/2018/credentials/v1'],
      },
      proofFormat: 'jwt', // JWT-Proof verwenden
    });

    res.json(credential);
  } catch (error) {
    console.error('Error issuing credential:', (error as Error).message);
    res.status(500).json({ error: 'Credential issuance failed' });
  }
});

app.post('/create-did', async (req, res) => {
  try {
    const identifier = await agent.didManagerCreate({
      provider: 'did:ethr:sepolia', // Netzwerk hier anpassen, falls notwendig
    });
    res.json(identifier);
  } catch (error) {
    console.error('Error creating DID:', (error as Error).message);
    res.status(500).json({ error: 'DID creation failed' });
  }
});

app.listen(PORT, () => {
  console.log(`Server läuft auf http://localhost:${PORT}`);
});
