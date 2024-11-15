import express from 'express'
import { agent } from './setup.js'; // Importiere den Agenten aus setup.ts

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
    const credential = await agent.createVerifiableCredential({
      credential: {
        issuer: { id: 'did:ethr:yourDID' },
        subject,
        type: ['VerifiableCredential'],
        issuanceDate: new Date().toISOString(),
        credentialSubject: claims,
      },
      proofFormat: 'jwt', // Falls JWT als Format verwendet wird
    });
    res.json(credential);
  } catch (error) {
    if (error instanceof Error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }
});

app.listen(PORT, () => {
  console.log(`Server läuft auf http://localhost:${PORT}`);
});
