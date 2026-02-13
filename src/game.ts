import { GameState, Player, Ball, InputState, GameConfig, NetworkMessage } from './types';
import { Physics } from './physics';
import { Renderer } from './renderer';
import { Network } from './network';

export class Game {
  private state: GameState;
  private physics: Physics;
  private renderer: Renderer;
  private network: Network;
  private config: GameConfig;
  private input: InputState;
  private localPlayerId: string = '';
  private animationFrameId: number = 0;
  private lastUpdateTime: number = 0;
  private gamePhase: 'menu' | 'lobby' | 'playing' = 'menu';

  // UI Elements
  private menuEl: HTMLElement;
  private gameEl: HTMLElement;

  constructor(canvas: HTMLCanvasElement, menuEl: HTMLElement, gameEl: HTMLElement) {
    this.config = {
      fieldWidth: 1000,
      fieldHeight: 600,
      playerRadius: 25,
      ballRadius: 15,
      playerSpeed: 5,
      kickForce: 15,
      friction: 0.95,
      goalWidth: 150,
    };

    this.menuEl = menuEl;
    this.gameEl = gameEl;

    this.state = this.createInitialState();
    this.physics = new Physics(this.config);
    this.renderer = new Renderer(canvas, this.config);
    this.network = new Network();
    this.input = { up: false, down: false, left: false, right: false, kick: false };

    this.setupInputHandlers();
    this.setupNetworkHandlers();
  }

  private createInitialState(): GameState {
    return {
      players: new Map(),
      ball: this.createBall(),
      score: { red: 0, blue: 0 },
      isPlaying: false,
      countdown: 0,
    };
  }

  private createBall(): Ball {
    return {
      position: { x: this.config.fieldWidth / 2, y: this.config.fieldHeight / 2 },
      velocity: { x: 0, y: 0 },
      radius: this.config.ballRadius,
    };
  }

  private createPlayer(id: string, name: string, team: 'red' | 'blue'): Player {
    const isRed = team === 'red';
    const playerCount = Array.from(this.state.players.values()).filter(p => p.team === team).length;

    return {
      id,
      position: {
        x: isRed ? 150 + playerCount * 50 : this.config.fieldWidth - 150 - playerCount * 50,
        y: this.config.fieldHeight / 2 + (playerCount % 2 === 0 ? -50 : 50) * Math.ceil(playerCount / 2),
      },
      velocity: { x: 0, y: 0 },
      team,
      name,
      isKicking: false,
      kickCooldown: 0,
    };
  }

  private setupInputHandlers(): void {
    document.addEventListener('keydown', (e) => {
      if (this.gamePhase === 'lobby') {
        if (e.key === 't' || e.key === 'T') {
          this.switchTeam();
          return;
        }
        if (e.code === 'Space' && this.network.isHosting) {
          e.preventDefault();
          this.startGame();
          return;
        }
      }

      if (this.gamePhase === 'playing') {
        switch (e.key.toLowerCase()) {
          case 'w': this.input.up = true; break;
          case 's': this.input.down = true; break;
          case 'a': this.input.left = true; break;
          case 'd': this.input.right = true; break;
          case ' ':
            e.preventDefault();
            if (!this.input.kick) {
              this.input.kick = true;
              this.handleKick();
            }
            break;
        }
      }
    });

    document.addEventListener('keyup', (e) => {
      switch (e.key.toLowerCase()) {
        case 'w': this.input.up = false; break;
        case 's': this.input.down = false; break;
        case 'a': this.input.left = false; break;
        case 'd': this.input.right = false; break;
        case ' ': this.input.kick = false; break;
      }
    });
  }

  private setupNetworkHandlers(): void {
    this.network.onMessage((message: NetworkMessage, peerId: string) => {
      switch (message.type) {
        case 'player-join':
          this.handlePlayerJoin(message.data);
          break;
        case 'player-leave':
          this.handlePlayerLeave(message.data.id);
          break;
        case 'player-update':
          this.handlePlayerUpdate(message.data);
          break;
        case 'ball-update':
          if (!this.network.isHosting) {
            this.handleBallUpdate(message.data);
          }
          break;
        case 'score-update':
          this.handleScoreUpdate(message.data);
          break;
        case 'game-state':
          this.handleGameState(message.data);
          break;
        case 'kick':
          this.handleRemoteKick(message.data.playerId);
          break;
      }
    });
  }

  private handlePlayerJoin(playerData: any): void {
    const player: Player = {
      ...playerData,
      velocity: playerData.velocity || { x: 0, y: 0 },
      isKicking: false,
      kickCooldown: 0,
    };
    this.state.players.set(player.id, player);

    // If host, send current game state to new player
    if (this.network.isHosting) {
      this.network.sendGameState(this.state);
    }
  }

  private handlePlayerLeave(playerId: string): void {
    this.state.players.delete(playerId);
  }

  private handlePlayerUpdate(data: any): void {
    const player = this.state.players.get(data.id);
    if (player && data.id !== this.localPlayerId) {
      player.position = data.position;
      player.velocity = data.velocity;
      player.team = data.team;
      player.isKicking = data.isKicking;
    }
  }

  private handleBallUpdate(data: any): void {
    this.state.ball.position = data.position;
    this.state.ball.velocity = data.velocity;
  }

  private handleScoreUpdate(data: any): void {
    this.state.score = data;
  }

  private handleGameState(data: any): void {
    // Restore players map
    this.state.players.clear();
    for (const [id, playerData] of data.players) {
      this.state.players.set(id, playerData);
    }
    this.state.ball = data.ball;
    this.state.score = data.score;
    this.state.isPlaying = data.isPlaying;
    this.state.countdown = data.countdown;

    // When game starts, non-host needs to start their game loop too
    if (data.isPlaying && this.gamePhase === 'lobby') {
      this.gamePhase = 'playing';
      this.showGame();
      this.startGameLoop(); // Start the game loop for non-host players!
    }
  }

  private handleRemoteKick(playerId: string): void {
    const player = this.state.players.get(playerId);
    if (player) {
      player.isKicking = true;
      setTimeout(() => { player.isKicking = false; }, 100);

      // Host handles the actual kick physics with extended range for network tolerance
      if (this.network.isHosting) {
        this.physics.kickWithExtendedRange(player, this.state.ball);
      }
    }
  }

  private handleKick(): void {
    const localPlayer = this.state.players.get(this.localPlayerId);
    if (localPlayer && localPlayer.kickCooldown <= 0) {
      // Always send kick to network - host will validate and process
      this.network.sendKick(this.localPlayerId);

      // If we're the host, also process locally
      if (this.network.isHosting) {
        this.physics.kick(localPlayer, this.state.ball);
      }

      // Set visual feedback and cooldown locally
      localPlayer.kickCooldown = 20;
      localPlayer.isKicking = true;
      setTimeout(() => { localPlayer.isKicking = false; }, 100);
    }
  }

  private switchTeam(): void {
    const player = this.state.players.get(this.localPlayerId);
    if (player) {
      player.team = player.team === 'red' ? 'blue' : 'red';
      // Reposition
      const newPlayer = this.createPlayer(player.id, player.name, player.team);
      player.position = newPlayer.position;
      this.network.sendPlayerJoin(player);
    }
  }

  async createRoom(playerName: string): Promise<string> {
    const roomId = await this.network.createRoom();
    this.localPlayerId = roomId;

    // Determine team based on current balance
    const redCount = Array.from(this.state.players.values()).filter(p => p.team === 'red').length;
    const blueCount = Array.from(this.state.players.values()).filter(p => p.team === 'blue').length;
    const team = redCount <= blueCount ? 'red' : 'blue';

    const player = this.createPlayer(roomId, playerName, team);
    this.state.players.set(roomId, player);

    this.gamePhase = 'lobby';
    this.showLobby();
    this.startLobbyLoop();

    return roomId;
  }

  async joinRoom(roomId: string, playerName: string): Promise<void> {
    await this.network.joinRoom(roomId);
    this.localPlayerId = this.network.peerId;

    // Determine team based on current balance (will be updated when we receive game state)
    const team = 'blue'; // Join blue by default, can switch

    const player = this.createPlayer(this.localPlayerId, playerName, team);
    this.state.players.set(this.localPlayerId, player);
    this.network.sendPlayerJoin(player);

    this.gamePhase = 'lobby';
    this.showLobby();
    this.startLobbyLoop();
  }

  private showLobby(): void {
    // Keep menu visible so room ID can be copied, but show game canvas too
    this.gameEl.style.display = 'flex';
  }

  private showGame(): void {
    // Hide menu when actual game starts
    this.menuEl.style.display = 'none';
    this.gameEl.style.display = 'flex';
  }

  private startLobbyLoop(): void {
    const loop = () => {
      if (this.gamePhase === 'lobby') {
        const roomId = this.network.isHosting ? this.localPlayerId : 'Connected';
        this.renderer.drawLobby(roomId, this.state.players, this.network.isHosting);
        requestAnimationFrame(loop);
      }
    };
    loop();
  }

  private startGame(): void {
    if (!this.network.isHosting) return;

    this.state.countdown = 180; // 3 seconds at 60fps
    this.state.isPlaying = true;
    this.gamePhase = 'playing';
    this.resetPositions();

    // Notify all players
    this.network.sendGameState(this.state);

    this.startGameLoop();
  }

  private resetPositions(): void {
    this.state.ball = this.createBall();

    let redIndex = 0;
    let blueIndex = 0;

    this.state.players.forEach((player) => {
      if (player.team === 'red') {
        player.position = {
          x: 150 + (redIndex % 2) * 80,
          y: this.config.fieldHeight / 2 + (redIndex < 2 ? -60 : 60) * (redIndex % 2 === 0 ? 1 : -1) + (Math.floor(redIndex / 2) * 100 - 50),
        };
        redIndex++;
      } else {
        player.position = {
          x: this.config.fieldWidth - 150 - (blueIndex % 2) * 80,
          y: this.config.fieldHeight / 2 + (blueIndex < 2 ? -60 : 60) * (blueIndex % 2 === 0 ? 1 : -1) + (Math.floor(blueIndex / 2) * 100 - 50),
        };
        blueIndex++;
      }
      player.velocity = { x: 0, y: 0 };
    });
  }

  private startGameLoop(): void {
    this.lastUpdateTime = performance.now();

    const gameLoop = () => {
      if (this.gamePhase !== 'playing') return;

      const currentTime = performance.now();
      const deltaTime = currentTime - this.lastUpdateTime;

      if (deltaTime >= 1000 / 60) { // 60 FPS target
        this.update();
        this.lastUpdateTime = currentTime;
      }

      this.renderer.render(this.state, this.localPlayerId);
      this.animationFrameId = requestAnimationFrame(gameLoop);
    };

    gameLoop();
  }

  private update(): void {
    // Update countdown
    if (this.state.countdown > 0) {
      this.state.countdown--;
      if (this.network.isHosting) {
        this.network.sendGameState(this.state);
      }
      return; // Don't update physics during countdown
    }

    // Update local player
    const localPlayer = this.state.players.get(this.localPlayerId);
    if (localPlayer) {
      this.physics.updatePlayer(localPlayer, this.input);
      this.network.sendPlayerUpdate(localPlayer);
    }

    // Host handles ball physics and collisions
    if (this.network.isHosting) {
      this.physics.updateBall(this.state.ball);

      // Player-ball collisions
      this.state.players.forEach((player) => {
        this.physics.handlePlayerBallCollision(player, this.state.ball);
      });

      // Player-player collisions
      const players = Array.from(this.state.players.values());
      for (let i = 0; i < players.length; i++) {
        for (let j = i + 1; j < players.length; j++) {
          this.physics.handlePlayerCollision(players[i], players[j]);
        }
      }

      // Check for goals
      const scorer = this.physics.checkGoal(this.state.ball);
      if (scorer) {
        this.state.score[scorer]++;
        this.network.sendScoreUpdate(this.state.score);
        this.resetPositions();
        this.state.countdown = 120; // 2 second pause after goal
      }

      // Broadcast ball state
      this.network.sendBallUpdate(this.state.ball);
    }
  }

  destroy(): void {
    cancelAnimationFrame(this.animationFrameId);
    this.network.disconnect();
  }
}
