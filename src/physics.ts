import { Vector2, Player, Ball, GameConfig } from './types';

export class Physics {
  constructor(private config: GameConfig) {}

  // Vector operations
  static add(a: Vector2, b: Vector2): Vector2 {
    return { x: a.x + b.x, y: a.y + b.y };
  }

  static subtract(a: Vector2, b: Vector2): Vector2 {
    return { x: a.x - b.x, y: a.y - b.y };
  }

  static multiply(v: Vector2, scalar: number): Vector2 {
    return { x: v.x * scalar, y: v.y * scalar };
  }

  static magnitude(v: Vector2): number {
    return Math.sqrt(v.x * v.x + v.y * v.y);
  }

  static normalize(v: Vector2): Vector2 {
    const mag = Physics.magnitude(v);
    if (mag === 0) return { x: 0, y: 0 };
    return { x: v.x / mag, y: v.y / mag };
  }

  static distance(a: Vector2, b: Vector2): number {
    return Physics.magnitude(Physics.subtract(a, b));
  }

  static dot(a: Vector2, b: Vector2): number {
    return a.x * b.x + a.y * b.y;
  }

  // Update player position based on input
  updatePlayer(player: Player, input: { up: boolean; down: boolean; left: boolean; right: boolean }): void {
    const acceleration = { x: 0, y: 0 };

    if (input.up) acceleration.y -= 1;
    if (input.down) acceleration.y += 1;
    if (input.left) acceleration.x -= 1;
    if (input.right) acceleration.x += 1;

    // Normalize diagonal movement
    const normalized = Physics.normalize(acceleration);

    // Apply acceleration
    player.velocity.x += normalized.x * this.config.playerSpeed * 0.5;
    player.velocity.y += normalized.y * this.config.playerSpeed * 0.5;

    // Limit max speed
    const speed = Physics.magnitude(player.velocity);
    if (speed > this.config.playerSpeed) {
      player.velocity = Physics.multiply(Physics.normalize(player.velocity), this.config.playerSpeed);
    }

    // Apply friction
    player.velocity.x *= this.config.friction;
    player.velocity.y *= this.config.friction;

    // Update position
    player.position.x += player.velocity.x;
    player.position.y += player.velocity.y;

    // Boundary collision (field bounds)
    const margin = this.config.playerRadius;
    player.position.x = Math.max(margin, Math.min(this.config.fieldWidth - margin, player.position.x));
    player.position.y = Math.max(margin, Math.min(this.config.fieldHeight - margin, player.position.y));

    // Update kick cooldown
    if (player.kickCooldown > 0) {
      player.kickCooldown--;
    }
  }

  // Update ball position
  updateBall(ball: Ball): void {
    // Apply velocity
    ball.position.x += ball.velocity.x;
    ball.position.y += ball.velocity.y;

    // Apply friction (less than players for smoother rolling)
    ball.velocity.x *= 0.985;
    ball.velocity.y *= 0.985;

    // Stop very slow movement
    if (Physics.magnitude(ball.velocity) < 0.1) {
      ball.velocity.x = 0;
      ball.velocity.y = 0;
    }

    // Wall collisions
    const goalTop = (this.config.fieldHeight - this.config.goalWidth) / 2;
    const goalBottom = (this.config.fieldHeight + this.config.goalWidth) / 2;

    // Left wall
    if (ball.position.x - ball.radius < 0) {
      // Check if in goal area
      if (ball.position.y > goalTop && ball.position.y < goalBottom) {
        // Goal scored - handled elsewhere
      } else {
        ball.position.x = ball.radius;
        ball.velocity.x *= -0.8;
      }
    }

    // Right wall
    if (ball.position.x + ball.radius > this.config.fieldWidth) {
      if (ball.position.y > goalTop && ball.position.y < goalBottom) {
        // Goal scored - handled elsewhere
      } else {
        ball.position.x = this.config.fieldWidth - ball.radius;
        ball.velocity.x *= -0.8;
      }
    }

    // Top wall
    if (ball.position.y - ball.radius < 0) {
      ball.position.y = ball.radius;
      ball.velocity.y *= -0.8;
    }

    // Bottom wall
    if (ball.position.y + ball.radius > this.config.fieldHeight) {
      ball.position.y = this.config.fieldHeight - ball.radius;
      ball.velocity.y *= -0.8;
    }
  }

  // Check and resolve player-ball collision (soft dribbling, not hard bounce)
  handlePlayerBallCollision(player: Player, ball: Ball): boolean {
    const dist = Physics.distance(player.position, ball.position);
    const minDist = this.config.playerRadius + ball.radius;

    if (dist < minDist) {
      // Calculate collision normal
      const normal = Physics.normalize(Physics.subtract(ball.position, player.position));

      // Separate objects (push ball out)
      const overlap = minDist - dist;
      ball.position.x += normal.x * (overlap + 1);
      ball.position.y += normal.y * (overlap + 1);

      // Soft collision - ball moves with the player
      const playerSpeed = Physics.magnitude(player.velocity);

      if (playerSpeed > 0.3) {
        // Push ball in direction player is moving
        const pushStrength = 0.4; // Increased push strength
        ball.velocity.x = ball.velocity.x * 0.7 + player.velocity.x * pushStrength;
        ball.velocity.y = ball.velocity.y * 0.7 + player.velocity.y * pushStrength;
      } else {
        // Even when standing still, give a small push in collision direction
        ball.velocity.x += normal.x * 0.5;
        ball.velocity.y += normal.y * 0.5;
      }

      return true;
    }
    return false;
  }

  // Player kick the ball
  kick(player: Player, ball: Ball): boolean {
    if (player.kickCooldown > 0) return false;

    const dist = Physics.distance(player.position, ball.position);
    const kickRange = this.config.playerRadius + ball.radius + 25;

    if (dist < kickRange) {
      const direction = Physics.normalize(Physics.subtract(ball.position, player.position));
      ball.velocity.x += direction.x * this.config.kickForce;
      ball.velocity.y += direction.y * this.config.kickForce;

      player.kickCooldown = 20; // Frames until next kick
      player.isKicking = true;
      setTimeout(() => { player.isKicking = false; }, 100);

      return true;
    }
    return false;
  }

  // Kick with extended range for network tolerance (used for remote players)
  kickWithExtendedRange(player: Player, ball: Ball): boolean {
    const dist = Physics.distance(player.position, ball.position);
    // More generous range to account for network latency
    const kickRange = this.config.playerRadius + ball.radius + 60;

    if (dist < kickRange) {
      const direction = Physics.normalize(Physics.subtract(ball.position, player.position));
      ball.velocity.x += direction.x * this.config.kickForce;
      ball.velocity.y += direction.y * this.config.kickForce;

      player.kickCooldown = 20;
      return true;
    }
    return false;
  }

  // Check for goals
  checkGoal(ball: Ball): 'red' | 'blue' | null {
    const goalTop = (this.config.fieldHeight - this.config.goalWidth) / 2;
    const goalBottom = (this.config.fieldHeight + this.config.goalWidth) / 2;

    // Ball in left goal (blue team scores)
    if (ball.position.x - ball.radius < 0 &&
        ball.position.y > goalTop &&
        ball.position.y < goalBottom) {
      return 'blue';
    }

    // Ball in right goal (red team scores)
    if (ball.position.x + ball.radius > this.config.fieldWidth &&
        ball.position.y > goalTop &&
        ball.position.y < goalBottom) {
      return 'red';
    }

    return null;
  }

  // Player-player collision
  handlePlayerCollision(p1: Player, p2: Player): void {
    const dist = Physics.distance(p1.position, p2.position);
    const minDist = this.config.playerRadius * 2;

    if (dist < minDist && dist > 0) {
      const normal = Physics.normalize(Physics.subtract(p2.position, p1.position));
      const overlap = minDist - dist;

      // Separate players
      p1.position.x -= normal.x * overlap * 0.5;
      p1.position.y -= normal.y * overlap * 0.5;
      p2.position.x += normal.x * overlap * 0.5;
      p2.position.y += normal.y * overlap * 0.5;

      // Exchange velocities (elastic collision)
      const relativeVelocity = Physics.subtract(p1.velocity, p2.velocity);
      const velocityAlongNormal = Physics.dot(relativeVelocity, normal);

      if (velocityAlongNormal > 0) {
        p1.velocity.x -= velocityAlongNormal * normal.x * 0.5;
        p1.velocity.y -= velocityAlongNormal * normal.y * 0.5;
        p2.velocity.x += velocityAlongNormal * normal.x * 0.5;
        p2.velocity.y += velocityAlongNormal * normal.y * 0.5;
      }
    }
  }
}
