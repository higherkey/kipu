import './style.css';

// PWA Support
import { registerSW } from 'virtual:pwa-register';

registerSW({
  onNeedRefresh() {
    // Show a prompt to the user to refresh the app
    console.log('New content available, click on reload button to update.');
  },
  onOfflineReady() {
    console.log('App ready to work offline');
  },
});

document.addEventListener('DOMContentLoaded', () => {
  const navShell = document.getElementById('navigation-shell');
  const gameCanvas = document.getElementById('game-canvas') as HTMLCanvasElement;
  const gameButtons = document.querySelectorAll('#game-list button');

  // Prevent default touch behaviors globally on the canvas
  if (gameCanvas) {
    gameCanvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
    }, { passive: false });
    
    gameCanvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
    }, { passive: false });
  }

  // Basic Navigation Logic
  if (navShell && gameCanvas) {
    // Show navigation initially
    navShell.classList.remove('hidden');

    gameButtons.forEach(button => {
      button.addEventListener('click', (e) => {
        const gameId = (e.target as HTMLButtonElement).dataset.game;
        
        // Hide nav, show canvas
        navShell.classList.add('hidden');
        gameCanvas.classList.remove('hidden');
        
        // Resize canvas to fill window
        resizeCanvas(gameCanvas);
        window.addEventListener('resize', () => resizeCanvas(gameCanvas));

        console.log(`Starting game: ${gameId}`);
        // TODO: Initialize specific game logic based on gameId
      });
    });
  }
});

function resizeCanvas(canvas: HTMLCanvasElement) {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
