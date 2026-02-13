import express from 'express';
import { ExpressPeerServer } from 'peer';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Health check (before static files)
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Serve static files from dist
app.use(express.static(join(__dirname, 'dist')));

// Start HTTP server
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`Haxball game + PeerJS server running on port ${PORT}`);
});

// Create PeerJS server on /peerjs path
const peerServer = ExpressPeerServer(server, {
  path: '/',
  allow_discovery: true,
  proxied: true,
});

app.use('/peerjs', peerServer);

// Log peer connections
peerServer.on('connection', (client) => {
  console.log(`Peer connected: ${client.getId()}`);
});

peerServer.on('disconnect', (client) => {
  console.log(`Peer disconnected: ${client.getId()}`);
});

// SPA fallback - serve index.html for non-API routes
app.get('*', (req, res) => {
  res.sendFile(join(__dirname, 'dist', 'index.html'));
});
