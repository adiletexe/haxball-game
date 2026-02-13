import express from 'express';
import { ExpressPeerServer } from 'peer';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 9000;

// Enable CORS for all origins (the game client)
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type'],
}));

// Health check endpoint for Railway
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'Haxball PeerJS Server',
    status: 'running',
    connections: peerServer._clients?.size || 0
  });
});

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`Haxball PeerJS server running on port ${PORT}`);
});

// Create PeerJS server
const peerServer = ExpressPeerServer(server, {
  path: '/',
  allow_discovery: true,
  proxied: true, // Important for Railway (behind proxy)
});

app.use('/peerjs', peerServer);

// Log connections
peerServer.on('connection', (client) => {
  console.log(`Client connected: ${client.getId()}`);
});

peerServer.on('disconnect', (client) => {
  console.log(`Client disconnected: ${client.getId()}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down...');
  server.close(() => {
    process.exit(0);
  });
});
