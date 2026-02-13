// Game Types

export interface Vector2 {
  x: number;
  y: number;
}

export interface Player {
  id: string;
  position: Vector2;
  velocity: Vector2;
  team: 'red' | 'blue';
  name: string;
  isKicking: boolean;
  kickCooldown: number;
}

export interface Ball {
  position: Vector2;
  velocity: Vector2;
  radius: number;
}

export interface GameState {
  players: Map<string, Player>;
  ball: Ball;
  score: { red: number; blue: number };
  isPlaying: boolean;
  countdown: number;
}

export interface InputState {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  kick: boolean;
}

export interface NetworkMessage {
  type: 'player-update' | 'ball-update' | 'score-update' | 'player-join' | 'player-leave' | 'game-state' | 'kick';
  data: any;
  timestamp: number;
}

export interface GameConfig {
  fieldWidth: number;
  fieldHeight: number;
  playerRadius: number;
  ballRadius: number;
  playerSpeed: number;
  kickForce: number;
  friction: number;
  goalWidth: number;
}
