import { GameState, Player, Ball, GameConfig } from './types';

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private canvas: HTMLCanvasElement;

  constructor(canvas: HTMLCanvasElement, private config: GameConfig) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  private resize(): void {
    const container = this.canvas.parentElement!;
    const aspectRatio = this.config.fieldWidth / this.config.fieldHeight;

    let width = container.clientWidth - 40;
    let height = width / aspectRatio;

    if (height > container.clientHeight - 200) {
      height = container.clientHeight - 200;
      width = height * aspectRatio;
    }

    this.canvas.width = this.config.fieldWidth;
    this.canvas.height = this.config.fieldHeight;
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
  }

  render(state: GameState, localPlayerId: string): void {
    this.clear();
    this.drawField();
    this.drawGoals();
    this.drawBall(state.ball);
    this.drawPlayers(state.players, localPlayerId);
    this.drawScore(state.score);

    if (state.countdown > 0) {
      this.drawCountdown(state.countdown);
    }
  }

  private clear(): void {
    this.ctx.fillStyle = '#2d5a27';
    this.ctx.fillRect(0, 0, this.config.fieldWidth, this.config.fieldHeight);
  }

  private drawField(): void {
    const ctx = this.ctx;
    const { fieldWidth, fieldHeight } = this.config;

    // Field outline
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 4;
    ctx.strokeRect(10, 10, fieldWidth - 20, fieldHeight - 20);

    // Center line
    ctx.beginPath();
    ctx.moveTo(fieldWidth / 2, 10);
    ctx.lineTo(fieldWidth / 2, fieldHeight - 10);
    ctx.stroke();

    // Center circle
    ctx.beginPath();
    ctx.arc(fieldWidth / 2, fieldHeight / 2, 80, 0, Math.PI * 2);
    ctx.stroke();

    // Center dot
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.beginPath();
    ctx.arc(fieldWidth / 2, fieldHeight / 2, 5, 0, Math.PI * 2);
    ctx.fill();

    // Penalty areas
    const penaltyWidth = 120;
    const penaltyHeight = 250;
    const penaltyY = (fieldHeight - penaltyHeight) / 2;

    // Left penalty area
    ctx.strokeRect(10, penaltyY, penaltyWidth, penaltyHeight);

    // Right penalty area
    ctx.strokeRect(fieldWidth - 10 - penaltyWidth, penaltyY, penaltyWidth, penaltyHeight);
  }

  private drawGoals(): void {
    const ctx = this.ctx;
    const { fieldHeight, goalWidth } = this.config;
    const goalTop = (fieldHeight - goalWidth) / 2;
    const goalDepth = 30;

    // Left goal (red team defends)
    ctx.fillStyle = 'rgba(231, 76, 60, 0.3)';
    ctx.fillRect(-goalDepth, goalTop, goalDepth + 5, goalWidth);
    ctx.strokeStyle = '#e74c3c';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(0, goalTop);
    ctx.lineTo(-goalDepth, goalTop);
    ctx.lineTo(-goalDepth, goalTop + goalWidth);
    ctx.lineTo(0, goalTop + goalWidth);
    ctx.stroke();

    // Right goal (blue team defends)
    ctx.fillStyle = 'rgba(52, 152, 219, 0.3)';
    ctx.fillRect(this.config.fieldWidth - 5, goalTop, goalDepth + 5, goalWidth);
    ctx.strokeStyle = '#3498db';
    ctx.beginPath();
    ctx.moveTo(this.config.fieldWidth, goalTop);
    ctx.lineTo(this.config.fieldWidth + goalDepth, goalTop);
    ctx.lineTo(this.config.fieldWidth + goalDepth, goalTop + goalWidth);
    ctx.lineTo(this.config.fieldWidth, goalTop + goalWidth);
    ctx.stroke();

    // Goal posts
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(0, goalTop, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, goalTop + goalWidth, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(this.config.fieldWidth, goalTop, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(this.config.fieldWidth, goalTop + goalWidth, 8, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawBall(ball: Ball): void {
    const ctx = this.ctx;

    // Ball shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.beginPath();
    ctx.ellipse(ball.position.x + 3, ball.position.y + 3, ball.radius, ball.radius * 0.7, 0, 0, Math.PI * 2);
    ctx.fill();

    // Ball
    const gradient = ctx.createRadialGradient(
      ball.position.x - ball.radius * 0.3,
      ball.position.y - ball.radius * 0.3,
      0,
      ball.position.x,
      ball.position.y,
      ball.radius
    );
    gradient.addColorStop(0, '#ffffff');
    gradient.addColorStop(1, '#cccccc');

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(ball.position.x, ball.position.y, ball.radius, 0, Math.PI * 2);
    ctx.fill();

    // Ball outline
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  private drawPlayers(players: Map<string, Player>, localPlayerId: string): void {
    players.forEach((player, id) => {
      this.drawPlayer(player, id === localPlayerId);
    });
  }

  private drawPlayer(player: Player, isLocal: boolean): void {
    const ctx = this.ctx;
    const { position, team, name, isKicking } = player;

    // Player shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.beginPath();
    ctx.ellipse(position.x + 2, position.y + 4, this.config.playerRadius, this.config.playerRadius * 0.6, 0, 0, Math.PI * 2);
    ctx.fill();

    // Kick indicator
    if (isKicking) {
      ctx.strokeStyle = '#f1c40f';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(position.x, position.y, this.config.playerRadius + 10, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Player body
    const teamColor = team === 'red' ? '#e74c3c' : '#3498db';
    const gradient = ctx.createRadialGradient(
      position.x - this.config.playerRadius * 0.3,
      position.y - this.config.playerRadius * 0.3,
      0,
      position.x,
      position.y,
      this.config.playerRadius
    );
    gradient.addColorStop(0, teamColor);
    gradient.addColorStop(1, team === 'red' ? '#c0392b' : '#2980b9');

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(position.x, position.y, this.config.playerRadius, 0, Math.PI * 2);
    ctx.fill();

    // Player outline
    ctx.strokeStyle = isLocal ? '#f1c40f' : '#fff';
    ctx.lineWidth = isLocal ? 4 : 2;
    ctx.stroke();

    // Player name
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(name, position.x, position.y - this.config.playerRadius - 5);

    // "YOU" indicator for local player
    if (isLocal) {
      ctx.fillStyle = '#f1c40f';
      ctx.font = 'bold 12px Arial';
      ctx.fillText('▼', position.x, position.y - this.config.playerRadius - 20);
    }
  }

  private drawScore(score: { red: number; blue: number }): void {
    const ctx = this.ctx;
    const centerX = this.config.fieldWidth / 2;

    // Score background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.roundRect(centerX - 80, 15, 160, 50, 10);
    ctx.fill();

    // Red score
    ctx.fillStyle = '#e74c3c';
    ctx.font = 'bold 32px Arial';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(score.red.toString(), centerX - 20, 40);

    // Separator
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.fillText('-', centerX, 40);

    // Blue score
    ctx.fillStyle = '#3498db';
    ctx.textAlign = 'left';
    ctx.fillText(score.blue.toString(), centerX + 20, 40);
  }

  private drawCountdown(countdown: number): void {
    const ctx = this.ctx;
    const centerX = this.config.fieldWidth / 2;
    const centerY = this.config.fieldHeight / 2;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, this.config.fieldWidth, this.config.fieldHeight);

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 120px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const displayText = countdown > 0 ? Math.ceil(countdown / 60).toString() : 'GO!';
    ctx.fillText(displayText, centerX, centerY);
  }

  drawLobby(roomId: string, players: Map<string, Player>, isHost: boolean): void {
    this.clear();
    const ctx = this.ctx;
    const centerX = this.config.fieldWidth / 2;

    // Title
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 48px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('HAXBALL', centerX, 80);

    // Room ID
    ctx.font = '24px Arial';
    ctx.fillText(`Room: ${roomId}`, centerX, 130);

    // Teams
    const redPlayers = Array.from(players.values()).filter(p => p.team === 'red');
    const bluePlayers = Array.from(players.values()).filter(p => p.team === 'blue');

    // Red team
    ctx.fillStyle = '#e74c3c';
    ctx.font = 'bold 28px Arial';
    ctx.fillText('RED TEAM', centerX - 200, 200);

    ctx.font = '20px Arial';
    redPlayers.forEach((p, i) => {
      ctx.fillText(p.name, centerX - 200, 240 + i * 30);
    });

    // Blue team
    ctx.fillStyle = '#3498db';
    ctx.font = 'bold 28px Arial';
    ctx.fillText('BLUE TEAM', centerX + 200, 200);

    ctx.font = '20px Arial';
    bluePlayers.forEach((p, i) => {
      ctx.fillText(p.name, centerX + 200, 240 + i * 30);
    });

    // Instructions
    ctx.fillStyle = '#fff';
    ctx.font = '18px Arial';
    ctx.fillText('Press T to switch teams', centerX, this.config.fieldHeight - 100);

    if (isHost) {
      ctx.fillStyle = '#2ecc71';
      ctx.fillText('Press SPACE to start the game', centerX, this.config.fieldHeight - 60);
    } else {
      ctx.fillStyle = '#95a5a6';
      ctx.fillText('Waiting for host to start...', centerX, this.config.fieldHeight - 60);
    }
  }
}
