# Haxball Game - Railway Deployment Guide

## Architecture

This game uses **PeerJS** for peer-to-peer multiplayer. For internet play, you need:

1. **PeerJS Server** (in `/server`) - Handles signaling for WebRTC connections
2. **Game Client** (root) - The actual game frontend

## Deployment Steps

### Step 1: Deploy the PeerJS Server

1. Go to [Railway](https://railway.app) and create a new project
2. Click "New Service" → "GitHub Repo"
3. Select this repo
4. **Important**: Set the root directory to `server`
5. Railway will auto-detect Node.js and deploy
6. Go to Settings → Networking → Generate Domain
7. Copy your server URL (e.g., `haxball-server-xxx.up.railway.app`)

### Step 2: Deploy the Game Client

1. In the same Railway project, add another service
2. Click "New Service" → "GitHub Repo" → Select this repo again
3. Keep root directory as `/` (root)
4. Add environment variable:
   - `VITE_PEER_SERVER_HOST` = your server URL from Step 1 (without https://)
   - Example: `haxball-server-xxx.up.railway.app`
5. Go to Settings → Networking → Generate Domain
6. Your game is now live!

## Environment Variables

### Client (Game Frontend)
| Variable | Description | Example |
|----------|-------------|---------|
| `VITE_PEER_SERVER_HOST` | PeerJS server hostname | `haxball-server.up.railway.app` |
| `VITE_PEER_SERVER_PORT` | PeerJS server port (default: 443 for HTTPS) | `443` |

### Server
| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port (set by Railway) | `9000` |

## Local Development

```bash
# Terminal 1: Start the PeerJS server
cd server
npm install
npm start

# Terminal 2: Start the game client
npm install
npm run dev
```

The client will connect to `localhost:9000` by default.

## How Multiplayer Works

1. One player creates a room → gets a room code (e.g., `HAX-ABC123`)
2. Other players join using the room code
3. The PeerJS server helps establish direct peer-to-peer connections
4. Once connected, game data flows directly between players (WebRTC)

The server is only used for initial connection setup, not for game data.
