import { Game } from './game';
import './style.css';

let game: Game | null = null;

function init(): void {
  const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
  const menuEl = document.getElementById('menu') as HTMLElement;
  const gameEl = document.getElementById('game') as HTMLElement;

  game = new Game(canvas, menuEl, gameEl);

  // UI Event handlers
  const playerNameInput = document.getElementById('playerName') as HTMLInputElement;
  const roomIdInput = document.getElementById('roomId') as HTMLInputElement;
  const createBtn = document.getElementById('createBtn') as HTMLButtonElement;
  const joinBtn = document.getElementById('joinBtn') as HTMLButtonElement;
  const errorEl = document.getElementById('error') as HTMLElement;
  const roomDisplay = document.getElementById('roomDisplay') as HTMLElement;
  const roomIdDisplay = document.getElementById('roomIdDisplay') as HTMLElement;
  const copyBtn = document.getElementById('copyBtn') as HTMLButtonElement;

  function showError(message: string): void {
    errorEl.textContent = message;
    errorEl.style.display = 'block';
    setTimeout(() => {
      errorEl.style.display = 'none';
    }, 5000);
  }

  createBtn.addEventListener('click', async () => {
    const name = playerNameInput.value.trim() || 'Player';

    try {
      createBtn.disabled = true;
      createBtn.textContent = 'Creating...';

      const roomId = await game!.createRoom(name);

      roomIdDisplay.textContent = roomId;
      roomDisplay.style.display = 'block';

    } catch (err) {
      showError('Failed to create room. Please try again.');
      console.error(err);
    } finally {
      createBtn.disabled = false;
      createBtn.textContent = 'Create Room';
    }
  });

  joinBtn.addEventListener('click', async () => {
    const name = playerNameInput.value.trim() || 'Player';
    const roomId = roomIdInput.value.trim().toUpperCase();

    if (!roomId) {
      showError('Please enter a room ID');
      return;
    }

    try {
      joinBtn.disabled = true;
      joinBtn.textContent = 'Joining...';

      await game!.joinRoom(roomId, name);

    } catch (err: any) {
      const message = err?.message || 'Failed to join room. Check the room ID and try again.';
      showError(message);
      console.error('Join error:', err);
    } finally {
      joinBtn.disabled = false;
      joinBtn.textContent = 'Join Room';
    }
  });

  copyBtn.addEventListener('click', () => {
    const roomId = roomIdDisplay.textContent || '';
    navigator.clipboard.writeText(roomId).then(() => {
      copyBtn.textContent = 'Copied!';
      setTimeout(() => {
        copyBtn.textContent = 'Copy';
      }, 2000);
    });
  });

  // Allow Enter key to submit
  playerNameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !roomIdInput.value) {
      createBtn.click();
    }
  });

  roomIdInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      joinBtn.click();
    }
  });
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', init);
