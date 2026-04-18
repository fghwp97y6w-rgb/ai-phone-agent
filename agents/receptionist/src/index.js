import 'dotenv/config';
import express from 'express';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import { buildStreamTwiml } from './twiml.js';
import { handleCallSession } from './session.js';

const PORT = process.env.PORT || 3000;
const PUBLIC_URL = process.env.PUBLIC_URL;

const required = [
  'ANTHROPIC_API_KEY',
  'DEEPGRAM_API_KEY',
  'ELEVENLABS_API_KEY',
  'ELEVENLABS_VOICE_ID',
  'TWILIO_ACCOUNT_SID',
  'TWILIO_AUTH_TOKEN',
  'PUBLIC_URL',
];
for (const v of required) {
  if (!process.env[v]) {
    console.error(`Missing required env var: ${v}`);
    process.exit(1);
  }
}

const app = express();
app.use(express.urlencoded({ extended: false }));

app.get('/health', (req, res) => res.send('ok'));

app.post('/incoming-call', (req, res) => {
  const callSid = req.body.CallSid ?? '';
  const fromNumber = req.body.From ?? '';
  console.log(`Incoming call: from=${fromNumber}, sid=${callSid.slice(-6)}`);
  const twiml = buildStreamTwiml({ publicUrl: PUBLIC_URL, callSid, fromNumber });
  res.type('text/xml').send(twiml);
});

const server = createServer(app);
const wss = new WebSocketServer({ server, path: '/media-stream' });

wss.on('connection', (ws) => {
  console.log('WebSocket connection opened on /media-stream');
  handleCallSession(ws);
});

server.listen(PORT, () => {
  console.log(`Receptionist listening on :${PORT}`);
  console.log(`Webhook: POST ${PUBLIC_URL}/incoming-call`);
  console.log(`Stream:  WSS  ${PUBLIC_URL.replace(/^https?:/, 'wss:')}/media-stream`);
});
