import Peer, { DataConnection } from 'peerjs';
import { NetworkMessage, Player, Ball, GameState } from './types';

type MessageHandler = (message: NetworkMessage, peerId: string) => void;

// PeerJS server configuration
// In production, connects to same host. In dev, connects to localhost:3000
const isProduction = window.location.hostname !== 'localhost';
const PEER_CONFIG = {
  host: window.location.hostname,
  port: isProduction ? 443 : 3000,
  path: '/peerjs',
  secure: isProduction,
};

export class Network {
  private peer: Peer | null = null;
  private connections: Map<string, DataConnection> = new Map();
  private messageHandlers: MessageHandler[] = [];
  private isHost: boolean = false;
  private roomId: string = '';

  get peerId(): string {
    return this.peer?.id || '';
  }

  get isHosting(): boolean {
    return this.isHost;
  }

  get connectedPeers(): string[] {
    return Array.from(this.connections.keys());
  }

  onMessage(handler: MessageHandler): void {
    this.messageHandlers.push(handler);
  }

  private emit(message: NetworkMessage, peerId: string): void {
    this.messageHandlers.forEach(handler => handler(message, peerId));
  }

  async createRoom(): Promise<string> {
    return new Promise((resolve, reject) => {
      // Generate a simple room ID
      const roomId = 'hax-' + Math.random().toString(36).substring(2, 8).toUpperCase();

      this.peer = new Peer(roomId, {
        ...PEER_CONFIG,
        debug: 1,
      });

      this.peer.on('open', (id) => {
        console.log('Room created with ID:', id);
        this.isHost = true;
        this.roomId = id;
        resolve(id);
      });

      this.peer.on('connection', (conn) => {
        this.handleConnection(conn);
      });

      this.peer.on('error', (err) => {
        console.error('Peer error:', err);
        if (err.type === 'unavailable-id') {
          // Try again with different ID
          this.peer?.destroy();
          this.createRoom().then(resolve).catch(reject);
        } else {
          reject(err);
        }
      });
    });
  }

  async joinRoom(roomId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      // Normalize room ID - add prefix if missing
      let normalizedRoomId = roomId.toUpperCase().trim();
      if (!normalizedRoomId.startsWith('HAX-')) {
        normalizedRoomId = 'hax-' + normalizedRoomId;
      }
      // Ensure consistent casing (hax- lowercase, rest uppercase)
      normalizedRoomId = 'hax-' + normalizedRoomId.replace('HAX-', '');

      console.log('Attempting to join room:', normalizedRoomId);

      this.peer = new Peer({
        ...PEER_CONFIG,
        debug: 2,
      });

      let connected = false;

      this.peer.on('open', () => {
        console.log('Connected to PeerJS server as:', this.peer?.id);

        const conn = this.peer!.connect(normalizedRoomId, {
          reliable: true,
        });

        conn.on('open', () => {
          console.log('Connected to room:', normalizedRoomId);
          connected = true;
          this.connections.set(conn.peer, conn);

          conn.on('data', (data) => {
            const message = data as NetworkMessage;
            this.emit(message, conn.peer);
          });

          conn.on('close', () => {
            console.log('Connection closed:', conn.peer);
            this.connections.delete(conn.peer);
          });

          this.roomId = normalizedRoomId;
          resolve();
        });

        conn.on('error', (err) => {
          console.error('Connection error:', err);
          if (!connected) {
            reject(new Error('Failed to connect to room. Make sure the room exists.'));
          }
        });
      });

      this.peer.on('error', (err: any) => {
        console.error('Peer error:', err);
        if (err.type === 'peer-unavailable') {
          reject(new Error('Room not found. Check the room ID.'));
        } else {
          reject(new Error('Connection failed: ' + err.message));
        }
      });

      // Also listen for incoming connections (for mesh network)
      this.peer.on('connection', (conn) => {
        this.handleConnection(conn);
      });

      // Timeout after 15 seconds
      setTimeout(() => {
        if (!connected && !this.connections.size) {
          reject(new Error('Connection timeout. Room may not exist.'));
        }
      }, 15000);
    });
  }

  private handleConnection(conn: DataConnection): void {
    conn.on('open', () => {
      console.log('Connection established with:', conn.peer);
      this.connections.set(conn.peer, conn);
    });

    conn.on('data', (data) => {
      const message = data as NetworkMessage;
      this.emit(message, conn.peer);
    });

    conn.on('close', () => {
      console.log('Connection closed:', conn.peer);
      this.connections.delete(conn.peer);
      this.emit({
        type: 'player-leave',
        data: { id: conn.peer },
        timestamp: Date.now(),
      }, conn.peer);
    });

    conn.on('error', (err) => {
      console.error('Connection error:', err);
    });
  }

  send(message: NetworkMessage, targetPeerId?: string): void {
    if (targetPeerId) {
      const conn = this.connections.get(targetPeerId);
      if (conn && conn.open) {
        conn.send(message);
      }
    } else {
      // Broadcast to all
      this.connections.forEach((conn) => {
        if (conn.open) {
          conn.send(message);
        }
      });
    }
  }

  sendPlayerUpdate(player: Player): void {
    this.send({
      type: 'player-update',
      data: {
        id: player.id,
        position: player.position,
        velocity: player.velocity,
        team: player.team,
        name: player.name,
        isKicking: player.isKicking,
      },
      timestamp: Date.now(),
    });
  }

  sendBallUpdate(ball: Ball): void {
    this.send({
      type: 'ball-update',
      data: ball,
      timestamp: Date.now(),
    });
  }

  sendScoreUpdate(score: { red: number; blue: number }): void {
    this.send({
      type: 'score-update',
      data: score,
      timestamp: Date.now(),
    });
  }

  sendGameState(state: GameState): void {
    const playersArray = Array.from(state.players.entries());
    this.send({
      type: 'game-state',
      data: {
        players: playersArray,
        ball: state.ball,
        score: state.score,
        isPlaying: state.isPlaying,
        countdown: state.countdown,
      },
      timestamp: Date.now(),
    });
  }

  sendKick(playerId: string): void {
    this.send({
      type: 'kick',
      data: { playerId },
      timestamp: Date.now(),
    });
  }

  sendPlayerJoin(player: Player): void {
    this.send({
      type: 'player-join',
      data: player,
      timestamp: Date.now(),
    });
  }

  disconnect(): void {
    this.connections.forEach((conn) => conn.close());
    this.connections.clear();
    this.peer?.destroy();
    this.peer = null;
    this.isHost = false;
  }
}
