import './style.css';
import { registerSW } from 'virtual:pwa-register';
import { Icons } from './ui/Icons';
import { IdleManager } from './core/IdleManager';
import { PauseMenu } from './ui/PauseMenu';
import type { Game } from './core/Game';
import { GameLoop } from './core/GameLoop';

// PWA Support
registerSW({
  onNeedRefresh() {
    console.log('New content available, click on reload button to update.');
  },
  onOfflineReady() {
    console.log('App ready to work offline');
  },
});

let activeGame: Game | null = null;
let gameLoop: GameLoop | null = null;
let pauseMenu: PauseMenu | null = null;
let idleManager: IdleManager | null = null;

document.addEventListener('DOMContentLoaded', () => {
  const navShell = document.getElementById('navigation-shell');
  const gameCanvas = document.getElementById('game-canvas') as HTMLCanvasElement;
  const gameButtons = document.querySelectorAll('#game-list button');

  // Inject Icons
  gameButtons.forEach(button => {
    const gameId = (button as HTMLElement).dataset.game;
    const iconContainer = button.querySelector('.icon');
    if (iconContainer && gameId) {
      const iconMap: Record<string, string> = {
        noButton: 'no',
        bubbleWrap: 'bubble',
        balloonPop: 'balloon',
        soundBoard: 'sound',
        particlePhysics: 'particle',
      };
      const iconKey = iconMap[gameId];
      if (iconKey && iconKey in Icons) {
        iconContainer.innerHTML = Icons[iconKey as keyof typeof Icons];
      }
    }
  });

  // Setup Global Systems
  pauseMenu = new PauseMenu(
    () => resumeGame(),
    () => exitToHome()
  );

  idleManager = new IdleManager(60000, () => {
    if (activeGame) pauseGame();
  });

  // Global touch prevention on canvas
  if (gameCanvas) {
    gameCanvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
    }, { passive: false });
    
    gameCanvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
    }, { passive: false });
  }

  // Navigation Logic
  if (navShell && gameCanvas) {
    navShell.classList.remove('hidden');

    gameButtons.forEach(button => {
      button.addEventListener('click', (e) => {
        const gameId = (e.currentTarget as HTMLButtonElement).dataset.game;
        if (!gameId) return;

        navShell.classList.add('hidden');
        gameCanvas.classList.remove('hidden');
        
        resizeCanvas(gameCanvas);
        window.addEventListener('resize', () => resizeCanvas(gameCanvas));

        startGame(gameId, gameCanvas);
      });
    });
  }
});

import { NoButtonGame } from './games/noButton/NoButtonGame';
import { BubbleWrapGame } from './games/bubbleWrap/BubbleWrapGame';
import { BalloonPopGame } from './games/balloonPop/BalloonPopGame';
import { SoundBoardGame } from './games/soundBoard/SoundBoardGame';
import { ParticlePhysicsGame } from './games/particlePhysics/ParticlePhysicsGame';

function startGame(gameId: string, canvas: HTMLCanvasElement) {
  // Clear previous game if any
  if (activeGame) activeGame.destroy();

  // Instantiate selected game
  switch (gameId) {
    case 'noButton':
      activeGame = new NoButtonGame();
      break;
    case 'bubbleWrap':
      activeGame = new BubbleWrapGame();
      break;
    case 'balloonPop':
      activeGame = new BalloonPopGame();
      break;
    case 'soundBoard':
      activeGame = new SoundBoardGame();
      break;
    case 'particlePhysics':
      activeGame = new ParticlePhysicsGame();
      break;
    default:
      console.warn(`Unknown game: ${gameId}`);
      return;
  }

  activeGame.init(canvas);
  
  gameLoop = new GameLoop((dt) => {
    if (activeGame) activeGame.update(dt);
  });
  gameLoop.start();
  idleManager?.start();
}

function pauseGame() {
  if (activeGame) activeGame.pause();
  gameLoop?.stop();
  pauseMenu?.show();
}

function resumeGame() {
  if (activeGame) activeGame.resume();
  gameLoop?.start();
  pauseMenu?.hide();
  idleManager?.start();
}

function exitToHome() {
  if (activeGame) activeGame.destroy();
  activeGame = null;
  gameLoop?.stop();
  gameLoop = null;
  pauseMenu?.hide();
  idleManager?.stop();

  const navShell = document.getElementById('navigation-shell');
  const gameCanvas = document.getElementById('game-canvas');
  navShell?.classList.remove('hidden');
  gameCanvas?.classList.add('hidden');
}

function resizeCanvas(canvas: HTMLCanvasElement) {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
